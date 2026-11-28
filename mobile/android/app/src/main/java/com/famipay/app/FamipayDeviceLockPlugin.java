package com.famipay.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FamipayDeviceLock")
public class FamipayDeviceLockPlugin extends Plugin {
    @PluginMethod public void status(PluginCall call) {
        getActivity().runOnUiThread(() -> call.resolve(((MainActivity)getActivity()).deviceLock.status()));
    }
    @PluginMethod public void configure(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        Integer minutes = call.getInt("minutes");
        if (enabled == null || minutes == null || !AppLockPolicy.validDelay(minutes)) {
            call.reject("Choose Immediately, After 5 minutes or After 30 minutes.");
            return;
        }
        getActivity().runOnUiThread(() -> ((MainActivity)getActivity()).deviceLock.configure(enabled, minutes, call));
    }
}
