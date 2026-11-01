import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {FileStore} from '../src/store.js';
import {createPipeline,scanChangedFiles} from '../src/pipeline.js';
import {createGitHubClient,assertRepositoryAllowed,formatPrReport,safePythonPath,REPORT_MARKER} from '../src/github.js';

const sha='a'.repeat(40), base='b'.repeat(40), repo='student/codesentinel-fixtures';
function reply(value,status=200){return {ok:status>=200&&status<300,status,json:async()=>value};}
function fixtureFetch({changedSha=sha,existingComments=[],fail=false}={}){
  const requests=[];
  async function fetchFn(url,opts){
    const u=new URL(url); requests.push({route:u.pathname+u.search,method:opts?.method||'GET',body:opts?.body});
    if(u.origin!=='https://api.github.com')throw new Error('Unexpected host');
    if(fail)return reply({},500);
    if(u.pathname.endsWith('/pulls/12'))return reply({head:{sha:changedSha},base:{sha:base,repo:{full_name:repo}}});
    if(u.pathname.endsWith('/pulls/12/files'))return reply([{filename:'src/demo.py',status:'modified',size:18}]);
    if(u.pathname.endsWith('/contents/src/demo.py'))return reply({type:'file',encoding:'base64',content:Buffer.from('eval(user_text)\n').toString('base64')});
    if(u.pathname.endsWith('/issues/12/comments')&&opts.method==='POST')return reply({id:987},201);
    if(u.pathname.endsWith('/issues/12/comments'))return reply(existingComments);
    if(u.pathname==='/user')return reply({login:'student'});
    if(u.pathname.includes('/issues/comments/'))return reply({id:5});
    throw new Error(`Unexpected GitHub API path ${u.pathname}`);
  }
  return {fetchFn,requests};
}
test('repo allowlist and changed Python path validation reject unsafe targets',()=>{
  assert.equal(assertRepositoryAllowed(repo,'student/codesentinel-fixtures'),repo);
  assert.throws(()=>assertRepositoryAllowed('other/repo','student/codesentinel-fixtures'));
  for(const bad of ['../secrets.py','../../private.py','/tmp/file.py','src\\test.py','docs/readme.md','folder/../safe.py'])assert.equal(safePythonPath(bad),false,bad);
  assert.equal(safePythonPath('src/helpers/safe_file.py'),true);
});
test('GitHub adapter downloads changed Python text only from official REST endpoint',async()=>{
  const fake=fixtureFetch(); const github=createGitHubClient({token:'example-test-token',fetchFn:fake.fetchFn});
  const files=await github.changedPythonFiles(repo,12,sha);
  assert.equal(files.length,1);assert.equal(files[0].bytes.toString(),'eval(user_text)\n');
  assert(fake.requests.every(r=>r.route.startsWith('/repos/')));
});
test('isolated scanner uses configured rule file; errors remain failures',async()=>{
  let capture;
  const result=await scanChangedFiles([{path:'pkg/demo.py',bytes:Buffer.from('eval(user_text)\n')}],{
    root:path.resolve('.'),execute:async(cmd,args,opts)=>{
      capture={cmd,args,opts};
      return {stdout:JSON.stringify({results:[{check_id:'codesentinel.python.dynamic-eval',path:`${opts.cwd}/pkg/demo.py`,start:{line:1},extra:{severity:'ERROR',message:'unsafe eval'}}],errors:[]})};
    },
  });
  assert.equal(result.status,'completed');assert.equal(result.findings[0].path,'pkg/demo.py');
  assert.equal(capture.cmd,'semgrep');assert(capture.args.includes('--metrics=off'));
  const failure=await scanChangedFiles([{path:'demo.py',bytes:Buffer.from('print(1)')}],{root:path.resolve('.'),execute:async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'});}});
  assert.equal(failure.status,'scanner_unavailable');assert.deepEqual(failure.findings,[]);
});
test('full mocked GitHub PR pipeline fetches fixed revision, scans and saves real-format findings without posting by default',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'cs-int-'));
  try{
    const store=new FileStore(dir);const fake=fixtureFetch();let scanned=null;
    const pipeline=createPipeline({store,root:path.resolve('.'),env:{GITHUB_TOKEN:'example-test-token',GITHUB_COMMENT_MODE:'off'},fetchFn:fake.fetchFn,
      runFiles:async files=>{scanned=files;return {status:'completed',findings:[{rule:'codesentinel.python.dynamic-eval',path:'src/demo.py',line:1,severity:'ERROR',message:'test'}],warning:null};}});
    const item=await store.add({repository:repo,prNumber:12,headSha:sha,baseSha:base,source:'github-pr-scan',status:'queued',findings:[]});
    await pipeline.process(item);
    const saved=(await store.all())[0];
    assert.equal(saved.status,'completed');assert.equal(saved.findings.length,1);assert.equal(saved.scannedFiles,1);assert.equal(scanned[0].path,'src/demo.py');
    assert.equal(saved.comment,'disabled_or_not_completed');
    assert(!fake.requests.some(x=>x.route.includes('/issues/')),'No comments without opt-in');
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('stale PR SHA blocks scanning, preserves failure instead of clean status',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'cs-stale-'));
  try{const store=new FileStore(dir),fake=fixtureFetch({changedSha:'c'.repeat(40)});
    const pipeline=createPipeline({store,root:path.resolve('.'),env:{GITHUB_TOKEN:'mock'},fetchFn:fake.fetchFn,runFiles:async()=>{throw new Error('should never be called');},logger:{warn:()=>{}}});
    const item=await store.add({repository:repo,prNumber:12,headSha:sha,baseSha:base,status:'queued',findings:[]});
    await pipeline.process(item);
    const saved=(await store.all())[0]; assert.equal(saved.status,'pipeline_failed');assert.equal(saved.findings.length,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('comments are created or updated with attribution and stable marker',async()=>{
  const created=fixtureFetch();const client=createGitHubClient({token:'mock',fetchFn:created.fetchFn});
  const body=formatPrReport({repository:repo,prNumber:12,headSha:sha,status:'completed',findings:[{severity:'ERROR',path:'src/x.py',line:1,rule:'test.eval',message:'danger'}],scannedFiles:1,durationMs:2000});
  assert(body.includes(REPORT_MARKER));
  assert.equal(await client.commentOnce(repo,12,body),'created');
  assert(created.requests.some(x=>x.method==='POST'&&x.route.endsWith('/issues/12/comments')));
  const updated=fixtureFetch({existingComments:[{id:5,body:body,user:{type:'User',login:'student'}}]});
  assert.equal(await createGitHubClient({token:'mock',fetchFn:updated.fetchFn}).commentOnce(repo,12,body),'updated');
  assert(updated.requests.some(x=>x.method==='PATCH'));
});
test('file store deduplicates logical scans and atomically updates status',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'cs-store2-'));
  try{const store=new FileStore(dir);
    const x=await Promise.all(Array.from({length:5},()=>store.addUniqueScan({scanKey:'scan-1',status:'queued'})));
    assert.equal(x.filter(z=>!z.duplicate).length,1);
    const id=x[0].item.id;const item=await store.update(id,{status:'completed',findings:[]});
    assert.equal(item.status,'completed');assert.equal((await store.all()).length,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
