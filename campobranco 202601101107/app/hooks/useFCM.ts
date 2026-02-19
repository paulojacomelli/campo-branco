"use client";

import { useEffect, useState, useCallback } from "react";
import { messaging, db } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "@/app/context/AuthContext";

export default function useFCM({ withListener = true } = {}) {
    const { user } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    const requestPermission = useCallback(async () => {
        try {
            const permission = await Notification.requestPermission();
            setPermission(permission);

            if (permission === "granted") {
                // Check if service worker is supported and ready
                if (!('serviceWorker' in navigator)) {
                    console.warn("Service workers are not supported.");
                    return;
                }

                // In development, the SW might be in a flux state (resetting)
                // We wait for it but don't let it block indefinitely if it fails
                const registration = await navigator.serviceWorker.ready;

                const msg = await messaging();
                if (!msg) {
                    console.warn("FCM not supported or initialization failed.");
                    return;
                }

                console.log("Registering FCM with Service Worker:", registration.scope);

                const currentToken = await getToken(msg, {
                    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log("FCM Token:", currentToken);
                    setToken(currentToken);

                    // Save token to user profile
                    if (user?.uid) {
                        const userRef = doc(db, "users", user.uid);
                        await setDoc(userRef, {
                            fcmTokens: arrayUnion(currentToken),
                            lastFcmUpdate: new Date()
                        }, { merge: true });
                    }
                } else {
                    console.log("No registration token available. Request permission to generate one.");
                }
            }
        } catch (error) {
            console.error("An error occurred while retrieving token. ", error);
            // Graceful fallback for development messaging errors
            if (process.env.NODE_ENV === 'development') {
                console.info("FCM Token retrieval skipped or failed in development. This is expected if the Service Worker is resetting.");
            }
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;

        // Initial permission check
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
            // If already granted, load token
            if (Notification.permission === 'granted') {
                requestPermission();
            }
        }
    }, [user, requestPermission]);

    // Optional: Handle foreground messages
    useEffect(() => {
        if (!withListener) return;

        const setupListener = async () => {
            const msg = await messaging();
            if (!msg) return;

            const unsubscribe = onMessage(msg, (payload) => {
                console.log("Message received. ", payload);
                const { title, body } = payload.notification || {};
                if (title && Notification.permission === 'granted') {
                    new Notification(title, { body, icon: '/app-icon.png' });
                }
            });
            return () => unsubscribe();
        };

        setupListener();
    }, [withListener]);

    return { token, permission, requestPermission };
}
