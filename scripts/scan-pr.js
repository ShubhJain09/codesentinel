/** Controlled CI entry point. Node 20+, fixed repo allowlist, read-only by default. */
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile,mkdir,appendFile} from 'node:fs/promises';
import {FileStore} from '../src/store.js';
import {createPipeline} from '../src/pipeline.js';
import {createGitHubClient,configuredGitHubToken,assertRepositoryAllowed,formatPrReport} from '../src/github.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [repo,prArg]=process.argv.slice(2),prNumber=Number(prArg);
if(!repo||!Number.isInteger(prNumber)||prNumber<1){console.error('Usage: node scripts/scan-pr.js owner/repo PR_NUMBER');process.exit(2);}
try{
  assertRepositoryAllowed(repo);
  const token=await configuredGitHubToken({});
  if(!token)throw new Error('GITHUB_TOKEN required for CI command');
  const gh=createGitHubClient({token});
  const pr=await gh.pr(repo,prNumber);
  const headSha=pr?.head?.sha,baseSha=pr?.base?.sha;
  if(!/^[a-f0-9]{40}$/.test(headSha)||!/^[a-f0-9]{40}$/.test(baseSha)) throw new Error('Invalid PR SHAs');
  const store=new FileStore(path.join(root,'data'));
  const record=await store.add({source:'github-pr-scan',repository:repo,prNumber,headSha,baseSha,status:'queued',findings:[]});
  const runner=createPipeline({root,store});
  await runner.process(record);
  const result=(await store.all()).find(x=>x.id===record.id);
  await mkdir(path.join(root,'reports'),{recursive:true});
  const out=path.join(root,'reports','latest-scan.json');
  await writeFile(out,JSON.stringify(result,null,2));
  const markdown=formatPrReport(result);
  if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,markdown+'\n');
  console.log(`CodeSentinel: ${result.status}; ${result.findings?.length??0} findings; JSON report: ${out}`);
  if(result.status!=='completed')process.exitCode=2;
  else if((result.findings||[]).some(f=>f.severity==='ERROR'))process.exitCode=1;
}catch(err){console.error('CodeSentinel CI failed:',String(err.message).slice(0,250));process.exitCode=2;}
