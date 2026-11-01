"""A deliberately insecure, synthetic file used only for static-analysis teaching.

DO NOT execute this module or copy this pattern into production code.
"""


def example_insecure_expression(user_input):
    return eval(user_input)  # Intentionally detectable by the controlled Semgrep rule.
