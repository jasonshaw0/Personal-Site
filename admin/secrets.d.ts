// Secret values are supplied as Worker secrets, never as frontend variables.
interface AdminEnv {
  GITHUB_TOKEN?: string;
  CF_ANALYTICS_TOKEN?: string;
  CF_SECURITY_TOKEN?: string;
}
