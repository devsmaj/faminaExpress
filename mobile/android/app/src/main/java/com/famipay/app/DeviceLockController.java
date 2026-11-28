package com.famipay.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

/** Native privacy lock for an already authenticated session. No PIN or biometrics enter JavaScript. */
final class DeviceLockController {
    private final MainActivity activity;
    private final SharedPreferences preferences;
    private final LinearLayout cover;
    private final TextView message;
    private boolean locked, authenticating;
    private long backgroundAt = -1;
    private BiometricPrompt prompt;

    DeviceLockController(MainActivity activity) {
        this.activity = activity;
        preferences = activity.getSharedPreferences("famipay_device_lock", Context.MODE_PRIVATE);
        cover = new LinearLayout(activity);
        cover.setOrientation(LinearLayout.VERTICAL);
        cover.setGravity(Gravity.CENTER);
        cover.setPadding(48, 48, 48, 48);
        cover.setBackgroundColor(Color.rgb(245, 250, 247));
        cover.setClickable(true);
        cover.setFocusableInTouchMode(true);
        TextView brand = new TextView(activity);
        brand.setText("FAMIPAY"); brand.setTextSize(30); brand.setTextColor(Color.rgb(0, 90, 70));
        message = new TextView(activity);
        message.setText("Unlock with fingerprint or your phone's screen-lock PIN, pattern or password.");
        message.setGravity(Gravity.CENTER); message.setTextSize(16); message.setPadding(0, 28, 0, 28);
        Button unlock = new Button(activity);
        unlock.setText("Unlock FAMIPAY");
        unlock.setOnClickListener(view -> authenticate(null, false, 0));
        cover.addView(brand); cover.addView(message); cover.addView(unlock);
    }

    private boolean enabled() { return preferences.getBoolean("enabled", false); }
    private int minutes() { return preferences.getInt("minutes", 0); }
    private boolean available() {
        KeyguardManager manager = (KeyguardManager)activity.getSystemService(Context.KEYGUARD_SERVICE);
        return manager != null && manager.isDeviceSecure();
    }
    JSObject status() {
        return new JSObject().put("enabled", enabled()).put("minutes", minutes()).put("available", available());
    }
    void start() {
        activity.addContentView(cover, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        cover.setVisibility(View.GONE);
        updateWindow();
        if (enabled()) { locked = true; showCover(); }
    }
    private void updateWindow() {
        if (enabled()) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
    private void showCover() {
        cover.setVisibility(View.VISIBLE); cover.bringToFront(); cover.requestFocus();
        activity.getBridge().getWebView().setVisibility(View.INVISIBLE);
        activity.getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }
    private void hideCover() {
        cover.setVisibility(View.GONE);
        activity.getBridge().getWebView().setVisibility(View.VISIBLE);
        activity.getBridge().getWebView().setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
    }
    void pause() {
        if (enabled()) {
            backgroundAt = SystemClock.elapsedRealtime();
            showCover();
        }
    }
    void resume() {
        if (!enabled() || authenticating) return;
        locked = AppLockPolicy.requiresUnlock(locked, backgroundAt, SystemClock.elapsedRealtime(), minutes());
        backgroundAt = -1;
        if (locked) { showCover(); authenticate(null, false, 0); }
        else hideCover();
    }
    void configure(boolean enable, int delay, PluginCall call) {
        if (locked || authenticating) { call.reject("Unlock FAMIPAY first."); return; }
        if (!available()) { call.reject("Set a screen-lock PIN or password in Android Settings first."); return; }
        authenticate(call, enable, delay);
    }
    private void authenticate(PluginCall call, boolean enable, int delay) {
        if (authenticating) return;
        if (!available()) {
            message.setText("Your phone's screen lock is unavailable. Set it up in Android Settings, then return to unlock FAMIPAY.");
            return;
        }
        authenticating = true;
        prompt = new BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                authenticating = false;
                if (call != null) {
                    if (!preferences.edit().putBoolean("enabled", enable).putInt("minutes", delay).commit()) {
                        call.reject("Unable to save app lock settings. Please try again.");
                        return;
                    }
                    updateWindow();
                }
                locked = false; backgroundAt = -1; hideCover();
                if (call != null) call.resolve(status());
            }
            @Override public void onAuthenticationError(int code, CharSequence error) {
                authenticating = false;
                if (enabled()) locked = AppLockPolicy.requiresUnlock(locked, backgroundAt, SystemClock.elapsedRealtime(), minutes());
                if (locked) { showCover(); message.setText(error); }
                else if (activity.hasWindowFocus()) hideCover();
                if (call != null) call.reject(error.toString());
            }
        });
        // Strong biometrics + device PIN are supported together from Android 11.
        int biometric = Build.VERSION.SDK_INT >= 30 ? BiometricManager.Authenticators.BIOMETRIC_STRONG : BiometricManager.Authenticators.BIOMETRIC_WEAK;
        try {
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(call == null ? "Unlock FAMIPAY" : "Confirm FAMIPAY app lock")
                .setSubtitle("Use fingerprint or your phone's screen-lock PIN")
                .setAllowedAuthenticators(biometric | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .build();
            prompt.authenticate(info);
        } catch (RuntimeException error) {
            authenticating = false;
            if (locked) { showCover(); message.setText("Device authentication is unavailable. Please try unlocking again."); }
            if (call != null) call.reject("Device authentication is unavailable. No settings changed.");
        }
    }
}
