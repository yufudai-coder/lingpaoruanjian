package com.example.license;

import android.util.Base64;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.security.KeyFactory;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECParameterSpec;
import java.security.AlgorithmParameters;
import java.security.spec.ECGenParameterSpec;

/** Verifies ES256 compact tokens issued by the Worker. Embed only the PUBLIC key. */
public final class LicenseVerifier {
    // Replace with the public JWK printed by scripts/generate-signing-key.mjs.
    public static final String PUBLIC_JWK_JSON = "{\"kty\":\"EC\",\"crv\":\"P-256\",\"x\":\"REPLACE_X\",\"y\":\"REPLACE_Y\"}";
    private LicenseVerifier() {}

    private static byte[] dec(String s) {
        return Base64.decode(s.replace('-', '+').replace('_', '/'), Base64.URL_SAFE | Base64.NO_WRAP);
    }

    private static ECPublicKey publicKey() throws Exception {
        JSONObject jwk = new JSONObject(PUBLIC_JWK_JSON);
        byte[] x = dec(jwk.getString("x")), y = dec(jwk.getString("y"));
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        ECParameterSpec spec = params.getParameterSpec(ECParameterSpec.class);
        java.security.spec.ECPoint point = new java.security.spec.ECPoint(
            new java.math.BigInteger(1, x), new java.math.BigInteger(1, y));
        java.security.spec.ECPublicKeySpec keySpec = new java.security.spec.ECPublicKeySpec(point, spec);
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(keySpec);
    }

    public static boolean verifyPermanentToken(String token, String expectedProduct, String expectedDevice) {
        try {
            String[] p = token.split("\\\\.");
            if (p.length != 3) return false;
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(publicKey());
            verifier.update((p[0] + "." + p[1]).getBytes(StandardCharsets.UTF_8));
            // WebCrypto ECDSA signature is IEEE-P1363 r||s (64 bytes); Java expects DER.
            byte[] raw = dec(p[2]);
            verifier.verify(rawToDer(raw));
            JSONObject payload = new JSONObject(new String(dec(p[1]), StandardCharsets.UTF_8));
            return "car-license".equals(payload.optString("iss"))
                && "permanent".equals(payload.optString("type"))
                && expectedProduct.equals(payload.optString("productId"))
                && expectedDevice.equals(payload.optString("deviceId"));
        } catch (Exception e) { return false; }
    }

    private static byte[] rawToDer(byte[] raw) throws Exception {
        if (raw.length != 64) throw new IllegalArgumentException("Invalid ES256 signature");
        byte[] r = integer(raw, 0), s = integer(raw, 32);
        int len = 2 + r.length + 2 + s.length;
        byte[] out = new byte[2 + len]; int i = 0;
        out[i++] = 0x30; out[i++] = (byte) len;
        out[i++] = 0x02; out[i++] = (byte) r.length; System.arraycopy(r,0,out,i,r.length); i+=r.length;
        out[i++] = 0x02; out[i++] = (byte) s.length; System.arraycopy(s,0,out,i,s.length);
        return out;
    }
    private static byte[] integer(byte[] src, int off) {
        int start=off; while(start<off+31 && src[start]==0) start++;
        int n=off+32-start; boolean prefix=(src[start]&0x80)!=0;
        byte[] out=new byte[n+(prefix?1:0)]; System.arraycopy(src,start,out,prefix?1:0,n); return out;
    }
}
