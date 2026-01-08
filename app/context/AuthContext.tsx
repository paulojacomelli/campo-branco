"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
    onAuthStateChanged,
    User,
    signOut as firebaseSignOut,
    getIdToken
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    role: string | null;
    congregationId: string | null;
    logout: () => Promise<void>;
    // Helper flags
    profileName: string | null;
    isSuperAdmin: boolean;
    isElder: boolean;
    isServant: boolean;
    // isAdmin is often used as a generic "has power" flag, aliasing to isElder or isSuperAdmin depending on logic.
    // Included here for backward compatibility if used.
    isAdmin: boolean;
    // Simulation
    simulateRole: (role: string | null) => void;
    isSimulating: boolean;
    actualRole: string | null;
    termType: 'city' | 'neighborhood';
    congregationType: 'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE' | null;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
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
    congregationType: null
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [actualRole, setActualRole] = useState<string | null>(null); // Real role from DB
    const [simulatedRole, setSimulatedRole] = useState<string | null>(null); // Simulation override
    const [congregationId, setCongregationId] = useState<string | null>(null);
    const [profileName, setProfileName] = useState<string | null>(null);
    const [termType, setTermType] = useState<'city' | 'neighborhood'>('city');
    const [congregationType, setCongregationType] = useState<'TRADITIONAL' | 'SIGN_LANGUAGE' | 'FOREIGN_LANGUAGE' | null>(null);

    // Effective role is the simulated one (if active) or the actual one
    const role = simulatedRole || actualRole;

    useEffect(() => {
        let isMounted = true;
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!isMounted) return;
            if (currentUser) {
                try {
                    // 1. Get Token (Client Side Only)
                    // We no longer sync with server sessions for Static Export compatibility

                    // 2. Fetch User Data from Firestore
                    // Try fetch by UID first
                    const { collection, query, where, getDocs, doc, getDoc } = await import('firebase/firestore');

                    let data: any = null;

                    try {
                        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                        if (userDoc.exists()) {
                            data = userDoc.data();
                        }
                    } catch (e) {
                        console.error("Auth: Failed to fetch user by UID", e);
                    }

                    if (!data && currentUser.email) {
                        try {
                            const q = query(collection(db, "users"), where("email", "==", currentUser.email));
                            const snaps = await getDocs(q);
                            if (!snaps.empty) {
                                data = snaps.docs[0].data();
                            }
                        } catch (e) {
                            console.error("Auth: Failed to fetch user by Email", e);
                        }

                        if (!data) {
                            console.warn("User seeded with different email casing? Please correct in DB.");
                        }
                    }

                    if (data) {
                        setActualRole(data.role || 'PUBLICADOR');
                        setCongregationId(data.congregationId || null);
                        setProfileName(data.name || currentUser.displayName); // Prefer DB name

                        // START: Legal Consent Enforcement
                        if (!data.termsAcceptedAt && window.location.pathname !== '/legal-consent' && window.location.pathname !== '/login') {
                            window.location.href = '/legal-consent';
                            return;
                        }
                        // END: Legal Consent Enforcement

                    } else {
                        setProfileName(currentUser.displayName);
                        setActualRole('PUBLICADOR');
                    }

                    setUser(currentUser);
                } catch (error) {
                    console.error("Auth Sync Error:", error);
                    // If sync fails (e.g. server down or invalid token), ensure we don't think we are logged in
                    setUser(null);
                    setActualRole(null);
                    setSimulatedRole(null);
                    setCongregationId(null);
                    await firebaseSignOut(auth);
                } finally {
                    setLoading(false);
                }
            } else {
                // User logged out
                setUser(null);
                setActualRole(null);
                setSimulatedRole(null);
                setCongregationId(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        await firebaseSignOut(auth);
    };

    const simulateRole = (newRole: string | null) => {
        if (actualRole === 'SUPER_ADMIN') {
            setSimulatedRole(newRole);
        }
    };

    // 3. Fetch Congregation Settings
    useEffect(() => {
        if (!congregationId) {
            setTermType('city');
            setCongregationType(null);
            return;
        }

        const fetchCong = async () => {
            try {
                const docSnap = await getDoc(doc(db, "congregations", congregationId));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTermType(data.termType || 'city');

                    // Map category to internal type
                    const cat = (data.category || '').toLowerCase();
                    if (cat.includes('sinais')) setCongregationType('SIGN_LANGUAGE');
                    else if (cat.includes('estrangeiro')) setCongregationType('FOREIGN_LANGUAGE');
                    else setCongregationType('TRADITIONAL'); // Default to traditional if unknown
                }
            } catch (err) {
                console.error("Error fetching congregation settings:", err);
            }
        };

        fetchCong();
    }, [congregationId]);

    // Derived flags
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isElder = role === 'ANCIAO' || isSuperAdmin;
    const isServant = role === 'SERVO' || isElder;
    const isAdmin = isSuperAdmin; // Conservative default, update if 'isAdmin' meant 'Elder' in legacy code

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            role,
            congregationId,
            profileName,
            logout,
            isSuperAdmin,
            isElder,
            isServant,
            isAdmin,
            // Simulation
            simulateRole,
            isSimulating: !!simulatedRole,
            actualRole,
            termType,
            congregationType
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
