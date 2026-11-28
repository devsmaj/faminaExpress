package com.famipay.app;

final class AppLockPolicy {
    static boolean validDelay(int minutes) { return minutes == 0 || minutes == 5 || minutes == 30; }
    static boolean requiresUnlock(boolean coldStart, long backgroundAt, long now, int minutes) {
        if (!validDelay(minutes)) return true;
        return coldStart || (backgroundAt >= 0 && (now < backgroundAt || now - backgroundAt >= minutes * 60000L));
    }
}
