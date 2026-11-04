package com.example.license;

import android.content.Context;
import android.provider.Settings;
import android.util.Base64;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Minimal Java client. Replace SERVER and PRODUCT_ID for each APK.
 * Never put admin/signing secrets in this class.
 */
public final class LicenseManager {
    public static final String SERVER = "https://YOUR-WORKER.workers.dev";
    public static final String PRODUCT_ID = "APP_A"; // APP_B in the second app
    private final Context context;
    private final String deviceId;

    public LicenseManager(Context context) throws Exception {
        this.context = context.getApplicationContext();
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId == null || androidId.isEmpty()) throw new IllegalStateException("Cannot read ANDROID_ID");
        deviceId = hex(MessageDigest.getInstance("SHA-256").digest(
            (PRODUCT_ID + ":" + androidId).getBytes(StandardCharsets.UTF_8)));
    }
    public String getDeviceId() { return deviceId; }

    public JSONObject activate(String code) throws Exception {
        JSONObject result = post("/api/activate", new JSONObject().put("productId",PRODUCT_ID).put("code",code).put("deviceId",deviceId));
        if ("permanent".equals(result.optString("type"))) saveToken(result.getString("licenseToken"));
        return result;
    }
    public JSONObject restore(String originalCode) throws Exception {
        JSONObject result = post("/api/restore", new JSONObject().put("productId",PRODUCT_ID).put("code",originalCode).put("deviceId",deviceId));
        saveToken(result.getString("licenseToken"));
        return result;
    }
    public JSONObject checkTrial(String code) throws Exception {
        return post("/api/trial/check", new JSONObject().put("productId",PRODUCT_ID).put("code",code).put("deviceId",deviceId));
    }
    public boolean hasValidPermanentLicense() {
        String token=loadToken();
        return token!=null && LicenseVerifier.verifyPermanentToken(token,PRODUCT_ID,deviceId);
    }
    private JSONObject post(String path, JSONObject body) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(SERVER+path).openConnection();
        c.setRequestMethod("POST"); c.setConnectTimeout(12000); c.setReadTimeout(12000);
        c.setDoOutput(true); c.setRequestProperty("Content-Type","application/json");
        try(OutputStream o=c.getOutputStream()){o.write(body.toString().getBytes(StandardCharsets.UTF_8));}
        InputStream in=(c.getResponseCode()<400)?c.getInputStream():c.getErrorStream();
        ByteArrayOutputStream b=new ByteArrayOutputStream(); byte[] buf=new byte[2048]; int n;
        while((n=in.read(buf))>0)b.write(buf,0,n);
        JSONObject r=new JSONObject(new String(b.toByteArray(),StandardCharsets.UTF_8));
        if(c.getResponseCode()>=400) throw new IOException(r.optString("error","授权验证失败"));
        return r;
    }
    private void saveToken(String token) throws Exception {
        File f=new File(context.getFilesDir(),"license.token");
        try(FileOutputStream o=new FileOutputStream(f)){o.write(token.getBytes(StandardCharsets.UTF_8));}
    }
    private String loadToken() {
        try { File f=new File(context.getFilesDir(),"license.token"); if(!f.exists())return null;
            ByteArrayOutputStream b=new ByteArrayOutputStream(); try(FileInputStream i=new FileInputStream(f)){byte[] x=new byte[1024];int n;while((n=i.read(x))>0)b.write(x,0,n);}
            return b.toString("UTF-8");
        } catch(Exception e){return null;}
    }
    private static String hex(byte[] b){StringBuilder s=new StringBuilder();for(byte x:b)s.append(String.format("%02x",x));return s.toString();}
}
