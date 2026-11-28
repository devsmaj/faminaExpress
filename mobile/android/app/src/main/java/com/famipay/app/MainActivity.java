package com.famipay.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    DeviceLockController deviceLock;

    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FamipayDeviceLockPlugin.class);
        super.onCreate(savedInstanceState);
        deviceLock = new DeviceLockController(this);
        deviceLock.start();
    }

    @Override public void onPause() {
        if (deviceLock != null) deviceLock.pause();
        super.onPause();
    }

    @Override public void onResume() {
        super.onResume();
        if (deviceLock != null) deviceLock.resume();
    }
}
