"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    role: string | null;
    congregationId: string | null;
    logout: () => Promise<void>;
    // Helper flags
    profileName: string | null;
    isSuperAdmin: boolean;
    isElder: boolean;
    isServant: boolean;
    isAdmin: boolean;
    // Simulation
    simulateRole: (role: string | null) => void;
    isSimulating: boolean;
    actualRole: string | null;
    termType: 'city' | 'neighborhood';
    congregationType: 'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE' | null;
    notificationsEnabled: boolean;
    setNotificationsEnabled: (enabled: boolean) => Promise<void>;
    canManageMembers: boolean;
    canInviteMembers: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    role: null,
    congregationId: null,
    logout: async () => { },
    profileName: null,
    isSuperAdmin: false,
    isElder: false,
    isServant: false,
    isAdmin: false,
    simulateRole: () => { },
    isSimulating: false,
    actualRole: null,
    termType: 'city',
    congregationType: null,
    notificationsEnabled: true,
    setNotificationsEnabled: async () => { },
    canManageMembers: false,
    canInviteMembers: false
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [actualRole, setActualRole] = useState<string | null>(null); // Real role from DB
    const [simulatedRole, setSimulatedRole] = useState<string | null>(null); // Simulation override
    const [congregationId, setCongregationId] = useState<string | null>(null);
    const [profileName, setProfileName] = useState<string | null>(null);
    const [termType, setTermType] = useState<'city' | 'neighborhood'>('city');
    const [congregationType, setCongregationType] = useState<'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE' | null>(null);
    const [notificationsEnabled, setNotificationsEnabledInternal] = useState(true);

    // Effective role is the simulated one (if active) or the actual one
    const role = simulatedRole || actualRole;

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            // Safety timeout: if auth takes more than 10 seconds, stop loading
            const timeout = setTimeout(() => {
                if (isMounted && loading) {
                    console.warn("Auth initialization timed out safety trigger");
                    setLoading(false);
                }
            }, 10000);

            try {
                // Short delay to allow browser to stabilize (avoids some AbortErrors in Dev)
                await new Promise(resolve => setTimeout(resolve, 100));
                if (!isMounted) return;

                // 1. Get Session
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    if (sessionError.message?.includes('AbortError')) {
                        console.warn("Session fetch aborted, will rely on onAuthStateChange");
                    } else {
                        throw sessionError;
                    }
                }

                if (isMounted && currentSession?.user) {
                    setUser(currentSession.user);
                    setSession(currentSession);
                    await fetchUserProfile(currentSession.user);
                } else if (isMounted) {
                    setLoading(false);
                }

                clearTimeout(timeout);
            } catch (err: any) {
                // Ignore AbortError as it usually means a new request is coming
                if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
                    console.warn("Auth init aborted (harmless)");
                } else {
                    console.error("Critical Auth Init Error:", err);
                    if (isMounted) setLoading(false);
                }
                clearTimeout(timeout);
            }
        };

        // 2. Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (!isMounted) return;

            if (newSession?.user) {
                setUser(newSession.user);
                setSession(newSession);
                await fetchUserProfile(newSession.user);
            } else {
                setUser(null);
                setSession(null);
                setActualRole(null);
                setSimulatedRole(null);
                setCongregationId(null);
                setProfileName(null);
                setLoading(false);
            }
        });

        initializeAuth();

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchUserProfile = async (currentUser: User) => {
        try {
            // Fetch User Data from Supabase 'users' table
            // We assume a trigger or manual insert created this record on signup, 
            // but for migration safety we might want to check existence.

            let { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', currentUser.id)
                .single();

            if (error && error.code === 'PGRST116') {
                // User not found in public.users table (maybe first login after migration?)
                // In a real app, we might create it here or rely on database triggers.
                console.warn("User record not found in public.users");
                data = null;
            } else if (error) {
                // Ignore AbortError which is harmless request cancellation
                if ((error as any).message?.includes('AbortError') || (error as any).details?.includes('AbortError')) {
                    // silently ignore
                } else {
                    console.error("Error fetching user profile:", JSON.stringify(error, null, 2));
                }
            }

            if (data) {
                setActualRole(data.role || 'PUBLICADOR');
                setCongregationId(data.congregation_id || null); // Note snake_case from SQL
                setProfileName(data.name || currentUser.user_metadata?.full_name || currentUser.email);

                // START: Legal Consent Enforcement
                if (!data.terms_accepted_at && window.location.pathname !== '/legal-consent' && window.location.pathname !== '/login') {
                    // window.location.href = '/legal-consent'; // Temporarily disabled for migration testing
                    // return;
                }
                // END: Legal Consent Enforcement

                setNotificationsEnabledInternal(data.notifications_enabled ?? true);

            } else {
                setProfileName(currentUser.user_metadata?.full_name || currentUser.email);
                setActualRole('PUBLICADOR');
            }
        } catch (error) {
            console.error("Auth Sync Error:", error);
            // Don't log out on sync error to avoid loops, just degrade
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    const updateNotificationsEnabled = async (enabled: boolean) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('users')
                .update({ notifications_enabled: enabled })
                .eq('id', user.id);

            if (error) throw error;
            setNotificationsEnabledInternal(enabled);
        } catch (error) {
            console.error("Error updating notifications preference:", error);
            throw error;
        }
    };

    const simulateRole = (newRole: string | null) => {
        if (actualRole === 'SUPER_ADMIN') {
            setSimulatedRole(newRole);
        }
    };

    // 3. Fetch Congregation Settings
    useEffect(() => {
        let isMounted = true;
        if (!congregationId) {
            setTermType('city');
            setCongregationType(null);
            return;
        }

        const fetchCong = async () => {
            try {
                const { data, error } = await supabase
                    .from('congregations')
                    .select('*')
                    .eq('id', congregationId)
                    .single();

                if (isMounted && data && !error) {
                    setTermType(data.term_type || 'city');

                    // Map category to internal type
                    const cat = (data.category || '').toLowerCase();
                    if (cat.includes('sinais')) setCongregationType('SIGN_LANGUAGE');
                    else if (cat.includes('estrangeiro')) setCongregationType('FOREIGN_LANGUAGE');
                    else setCongregationType('TRADITIONAL');
                }
            } catch (err) {
                console.error("Error fetching congregation settings:", err);
            }
        };

        fetchCong();
        return () => { isMounted = false; };
    }, [congregationId]);

    // Derived flags
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isElder = role === 'ANCIAO' || isSuperAdmin;
    const isServant = role === 'SERVO' || isElder;
    const isAdmin = isElder; // Ancião e Superadmin são considerados admins de congregação

    const canManageMembers = isElder;
    const canInviteMembers = isServant;

    return (
        <AuthContext.Provider value={{
            user,
            session,
            loading,
            role,
            congregationId,
            profileName,
            logout,
            isSuperAdmin,
            isElder,
            isServant,
            isAdmin,
            simulateRole,
            isSimulating: !!simulatedRole,
            actualRole,
            termType,
            congregationType,
            notificationsEnabled,
            setNotificationsEnabled: updateNotificationsEnabled,
            canManageMembers,
            canInviteMembers
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
