/**
 * 在所有其他模块求值之前加载 .env 并清洗单行环境变量。
 *
 * GitHub Secrets / 本地粘贴 token 时很容易带入首尾换行或空格。
 * wrangler 把 CLOUDFLARE_API_TOKEN 原样拼进
 * `Authorization: Bearer <token>` 请求头，值里含有换行时 undici 会直接抛
 * `Headers.append: "..." is an invalid header value`，而 token 又会被脱敏成
 * ***，极难定位。这里先做 trim；若值内部仍含换行，说明 secret 本身已损坏，
 * 直接报错指出变量名，要求重新填写纯单行值。
 *
 * 本模块通过副作用在导入时立即执行，因此调用方必须直接导入本模块
 * （而不是只导入 dotenv/config），以保证清洗发生在读取环境变量之前。
 */
import "dotenv/config";
const SINGLE_LINE_ENV_VARS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "AUTH_SECRET",
  "AUTH_GITHUB_ID",
  "AUTH_GITHUB_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "PROJECT_NAME",
  "DATABASE_NAME",
  "DATABASE_ID",
  "KV_NAMESPACE_NAME",
  "KV_NAMESPACE_ID",
  "CUSTOM_DOMAIN",
];

export function sanitizeEnvironment() {
  for (const varName of SINGLE_LINE_ENV_VARS) {
    const value = process.env[varName];
    if (!value) continue;

    const trimmed = value.trim();

    if (/[\r\n]/.test(trimmed)) {
      throw new Error(
        `Environment variable ${varName} contains a line break. ` +
          `Please delete and re-create it with only the raw single-line value ` +
          `(paste the token without any trailing newline or extra lines).`
      );
    }

    if (trimmed !== value) {
      console.log(`🧹 Removed leading/trailing whitespace from ${varName}`);
      process.env[varName] = trimmed;
    }
  }
}

sanitizeEnvironment();
