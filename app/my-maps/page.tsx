"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import {
    Loader2,
    Search,
    Building2,
    ArrowRight,
    Pencil,
    Trash2,
    X,
    LogOut,
    Check,
    Map,
    MoreVertical
} from 'lucide-react';
import BottomNav from '@/app/components/BottomNav';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { toast } from 'sonner';
import ConfirmationModal from '@/app/components/ConfirmationModal';

interface Congregation {
    id: string;
    name: string;
    category?: string;
    created_at?: string;
}

export default function CongregationListPage() {
    const { user, isSuperAdmin, isElder, isServant, loading: authLoading, congregationId } = useAuth();
    const router = useRouter();

    // Redirect Unassigned Users
    useEffect(() => {
        if (!authLoading && user && !congregationId && !isSuperAdmin) {
            router.push('/unassigned');
        }
    }, [user, authLoading, congregationId, isSuperAdmin, router]);

    // Redirect Non-Servants
    useEffect(() => {
        if (!authLoading && user && !isServant) {
            router.replace('/dashboard');
        }
    }, [user, authLoading, isServant, router]);

    // Automatic Redirection for Superadmins or Servants
    useEffect(() => {
        if (!authLoading && user && isServant) {
            if (congregationId) {
                // If has a congregation, go directly to their city list
                router.replace(`/my-maps/city?congregationId=${congregationId}`);
            } else if (isSuperAdmin) {
                // If Superadmin without congregation, go to admin panel
                router.replace('/admin/congregations');
            }
        }
    }, [user, authLoading, congregationId, isSuperAdmin, isServant, router]);

    return (
        <div className="bg-background min-h-screen pb-32 font-sans flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 opacity-50">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted uppercase tracking-widest">Redirecionando...</p>
            </div>
            <BottomNav />
        </div>
    );
}

