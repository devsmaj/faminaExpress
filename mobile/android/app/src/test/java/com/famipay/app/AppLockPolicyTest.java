package com.famipay.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class AppLockPolicyTest {
    @Test public void coldStartAlwaysLocks() {
        for (int delay : new int[]{0,5,30}) assertTrue(AppLockPolicy.requiresUnlock(true,-1,100,delay));
    }
    @Test public void immediateLocksOnlyAfterLeaving() {
        assertFalse(AppLockPolicy.requiresUnlock(false,-1,100,0));
        assertTrue(AppLockPolicy.requiresUnlock(false,100,100,0));
    }
    @Test public void fiveMinuteBoundary() {
        assertFalse(AppLockPolicy.requiresUnlock(false,1000,300999,5));
        assertTrue(AppLockPolicy.requiresUnlock(false,1000,301000,5));
    }
    @Test public void thirtyMinuteBoundary() {
        assertFalse(AppLockPolicy.requiresUnlock(false,1000,1800999,30));
        assertTrue(AppLockPolicy.requiresUnlock(false,1000,1801000,30));
    }
    @Test public void invalidDelayOrClockResetFailsClosed() {
        assertTrue(AppLockPolicy.requiresUnlock(false,1000,500,5));
        assertTrue(AppLockPolicy.requiresUnlock(false,-1,1000,1));
    }
}
