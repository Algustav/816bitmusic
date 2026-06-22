import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as NavigatorWithStandalone).standalone)
  );
}

export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [registered, setRegistered] = useState(Boolean(navigator.serviceWorker?.controller));
  const [registrationError, setRegistrationError] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosInstall, setShowIosInstall] = useState(isIos() && !isStandalone());
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        void navigator.serviceWorker.ready.then(() => setRegistered(true));
      }
    },
    onRegisterError() {
      setRegistrationError(true);
    }
  });

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const status = registrationError
    ? "离线缓存失败"
    : !online
      ? "当前离线"
      : needRefresh
        ? "发现新版本"
        : offlineReady || registered
          ? "已可离线使用"
          : "正在准备离线资源";

  return (
    <section className="pwa-status" aria-live="polite">
      <span
        className={`pwa-status__dot ${
          registrationError ? "is-error" : offlineReady || registered ? "is-ready" : ""
        }`}
      />
      <strong>{status}</strong>
      {installPrompt && (
        <button type="button" onClick={() => void install()}>
          安装应用
        </button>
      )}
      {showIosInstall && (
        <button type="button" onClick={() => setShowIosInstall(false)}>
          iOS：分享 → 添加到主屏幕
        </button>
      )}
      {needRefresh && (
        <button type="button" onClick={() => void updateServiceWorker(true)}>
          刷新更新
        </button>
      )}
      {registrationError && (
        <button type="button" onClick={() => window.location.reload()}>
          重试
        </button>
      )}
      {(offlineReady || needRefresh) && (
        <button
          className="pwa-status__dismiss"
          type="button"
          aria-label="关闭提示"
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          ×
        </button>
      )}
    </section>
  );
}
