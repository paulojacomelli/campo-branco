import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export interface AuthorizedUser {
    uid: string;
    email?: string;
    role: string;
    roles: string[];
    congregationId?: string;
    [key: string]: any;
}

export async function checkAuth(): Promise<AuthorizedUser | null> {
    try {
        const supabase = createServerComponentClient({ cookies });
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return null;
        }

        const user = session.user;
        const uid = user.id;

        // Fetch full user profile from Supabase profiles table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', uid)
            .single();

        if (userError || !userData) {
            // Default to publisher if no profile found
            return {
                uid,
                email: user.email,
                role: 'PUBLISHER',
                roles: ['PUBLISHER'],
            };
        }

        return {
            uid,
            email: user.email,
            role: userData.role || 'PUBLISHER',
            roles: userData.roles || [userData.role || 'PUBLISHER'],
            congregationId: userData.congregation_id,
            ...userData
        };
    } catch (error) {
        console.error('[AUTH] Supabase session verification failed:', error);
        return null;
    }
}

export async function requireAuth(allowedRoles?: string[]): Promise<AuthorizedUser> {
    const user = await checkAuth();

    if (!user) {
        throw new Error('Unauthorized');
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
        const hasPermission = userRoles.some((role: string) => allowedRoles.includes(role)) || user.role === 'SUPER_ADMIN';

        if (!hasPermission) {
            throw new Error('Forbidden');
        }
    }

    return user;
}
