import crypto from "crypto";

export function verifyWebhookSignature(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("GITHUB_WEBHOOK_SECRET is not set. Webhook verification will fail in production.");
    return false;
  }

  if (!signatureHeader) return false;

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf-8");
  const computedSignature = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf-8"),
      Buffer.from(computedSignature, "utf-8")
    );
  } catch {
    return false;
  }
}
