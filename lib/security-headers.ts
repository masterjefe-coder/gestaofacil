type BuildContentSecurityPolicyInput = {
  isDevelopment?: boolean;
  appBaseUrl?: string;
  evolutionApiBaseUrl?: string;
};

type ContentSecurityPolicyDirective = [string, string[]];

function toOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildContentSecurityPolicy(input: BuildContentSecurityPolicyInput = {}) {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'"];
  const workerSrc = ["'self'", "blob:"];

  if (input.isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
    connectSrc.push("ws:", "wss:", "http://localhost:*", "http://127.0.0.1:*");
  }

  const appOrigin = toOrigin(input.appBaseUrl);
  const evolutionOrigin = toOrigin(input.evolutionApiBaseUrl);

  for (const origin of unique([appOrigin, evolutionOrigin])) {
    if (origin !== "null" && !connectSrc.includes(origin)) {
      connectSrc.push(origin);
    }
  }

  const directives: ContentSecurityPolicyDirective[] = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
    ["font-src", ["'self'", "data:", "https://fonts.gstatic.com"]],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["connect-src", connectSrc],
    ["media-src", ["'self'", "data:", "blob:"]],
    ["object-src", ["'none'"]],
    ["frame-src", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["manifest-src", ["'self'"]],
    ["worker-src", workerSrc],
  ];

  if (!input.isDevelopment) {
    directives.push(["upgrade-insecure-requests", []]);
  }

  return directives
    .map(([directive, values]) => values.length > 0 ? `${directive} ${values.join(" ")}` : directive)
    .join("; ");
}

export function getDefaultSecurityHeaders() {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy({
        isDevelopment: process.env.NODE_ENV !== "production",
        appBaseUrl: process.env.APP_BASE_URL,
        evolutionApiBaseUrl: process.env.EVOLUTION_API_BASE_URL,
      }),
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];
}
