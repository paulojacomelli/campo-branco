"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/lib/supabase";

export type ThemeMode = 'light' | 'dark' | 'auto' | 'system';

interface ThemeContextType {
    textSize: number; // in pixels (default 16)
    displayScale: number; // multiplier (default 1)
    themeMode: ThemeMode;
    updatePreferences: (newTextSize: number, newDisplayScale: number, newThemeMode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
    textSize: 16,
    displayScale: 1,
    themeMode: 'auto',
    updatePreferences: async () => { }
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [textSize, setTextSize] = useState(16);
    const [displayScale, setDisplayScale] = useState(1);
    const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
    const [loaded, setLoaded] = useState(false);

    // Apply styles
    useEffect(() => {
        const root = document.documentElement;
        root.style.fontSize = `${textSize}px`;

        // Use CSS variable/zoom for body
        (document.body.style as any).zoom = displayScale;

        // Theme Mode Logic
        const applyTheme = () => {
            let isDark = false;

            if (themeMode === 'dark') {
                isDark = true;
            } else if (themeMode === 'light') {
                isDark = false;
            } else if (themeMode === 'auto') {
                // Time based: 19:00 - 07:00 is Dark
                const hour = new Date().getHours();
                isDark = hour >= 19 || hour < 7;
            } else if (themeMode === 'system') {
                // Device based
                isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }

            if (isDark) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        applyTheme();

        // Listeners/Intervals
        const cleanup = () => { };

        if (themeMode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme();
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else if (themeMode === 'auto') {
            // Check every minute for time change
            const interval = setInterval(applyTheme, 60000);
            return () => clearInterval(interval);
        }

        localStorage.setItem("app-preferences", JSON.stringify({ textSize, displayScale, themeMode }));
    }, [textSize, displayScale, themeMode]);

    // Load from LocalStorage (fast)
    useEffect(() => {
        const saved = localStorage.getItem("app-preferences");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.textSize) setTextSize(parsed.textSize);
                if (parsed.displayScale) setDisplayScale(parsed.displayScale);
                if (parsed.themeMode) setThemeMode(parsed.themeMode);
            } catch (e) {
                console.warn("Failed to parse local preferences");
            }
        }
        setLoaded(true);
    }, []);

    // Sync from Supabase (authoritative)
    useEffect(() => {
        if (user && loaded) {
            const fetchPrefs = async () => {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('preferences')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (!error && data?.preferences) {
                        const prefs = data.preferences as any;
                        if (prefs.textSize) setTextSize(prefs.textSize);
                        if (prefs.displayScale) setDisplayScale(prefs.displayScale);
                        if (prefs.themeMode) setThemeMode(prefs.themeMode);
                    }
                } catch (error) {
                    console.error("Error fetching preferences:", error);
                }
            };
            fetchPrefs();
        }
    }, [user, loaded]);

    const updatePreferences = async (newTextSize: number, newDisplayScale: number, newThemeMode: ThemeMode) => {
        setTextSize(newTextSize);
        setDisplayScale(newDisplayScale);
        setThemeMode(newThemeMode);

        const prefsObject = {
            textSize: newTextSize,
            displayScale: newDisplayScale,
            themeMode: newThemeMode
        };

        localStorage.setItem("app-preferences", JSON.stringify(prefsObject));

        if (user) {
            try {
                await supabase
                    .from('users')
                    .update({
                        preferences: prefsObject
                    })
                    .eq('id', user.id);
            } catch (error) {
                console.error("Error saving preferences:", error);
            }
        }
    };

    return (
        <ThemeContext.Provider value={{ textSize, displayScale, themeMode, updatePreferences }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
