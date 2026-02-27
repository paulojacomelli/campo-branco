// app/api/admin/schema-check/route.ts
// Verifica a conectividade com o Firestore e as coleções básicas

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firestore';

export async function POST(req: Request) {
    try {
        // Simples verificação de leitura no Firestore
        const congSnap = await adminDb.collection('congregations').limit(1).get();

        return NextResponse.json({
            status: 'online',
            message: "Firebase Admin SDK está conectado e operacional.",
            collections: {
                congregations: !congSnap.empty
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
