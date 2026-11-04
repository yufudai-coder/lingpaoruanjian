import { generateKeyPairSync, createPublicKey } from "node:crypto";
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "der" }
});
const jwk = createPublicKey({ key: publicKey, format: "der", type: "spki" }).export({ format: "jwk" });
console.log("Cloudflare SIGNING_KEY (base64 PKCS#8 DER) — keep private:");
console.log(privateKey.toString("base64"));
console.log("\nAndroid PUBLIC_JWK_JSON — safe to embed:");
console.log(JSON.stringify(jwk));
