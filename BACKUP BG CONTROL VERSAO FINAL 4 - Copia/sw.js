// sw.js - Service Worker Básico para PWA (Obrigatório para instalação Android/PC)
const CACHE_NAME = 'bg-control-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Permite que o app funcione e passe na verificação de PWA do Chrome
    event.respondWith(fetch(event.request).catch(() => new Response('Você está offline.')));
});
