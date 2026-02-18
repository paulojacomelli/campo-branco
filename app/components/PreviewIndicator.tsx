'use client';

import React, { useEffect, useState } from 'react';

export default function PreviewIndicator() {
    const [isDev, setIsDev] = useState(false);

    useEffect(() => {
        // Only show in development mode
        if (process.env.NODE_ENV === 'development') {
            setIsDev(true);
        }
    }, []);

    if (!isDev) return null;

    return null;
}
