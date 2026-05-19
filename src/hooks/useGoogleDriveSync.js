import { useState, useEffect, useCallback, useRef } from "react";

// Client ID por defecto creado por el desarrollador.
// Puedes cambiarlo directamente aquí o definir VITE_GOOGLE_CLIENT_ID en tu archivo .env
const DEFAULT_CLIENT_ID = "616641551044-pqp1qg9gpep0h9h9p0pepepepepepepe.apps.googleusercontent.com"; // Reemplaza esto con tu Client ID real de Google Cloud

export function useGoogleDriveSync() {
  const [clientId, setClientId] = useState(() => {
    return (
      import.meta.env.VITE_GOOGLE_CLIENT_ID ||
      localStorage.getItem("lsv-gdrive-client-id") ||
      DEFAULT_CLIENT_ID
    );
  });
  const [accessToken, setAccessToken] = useState(() => {
    return sessionStorage.getItem("lsv-gdrive-token") || null;
  });
  const [syncStatus, setSyncStatus] = useState("idle"); // idle, connecting, connected, syncing, success, error
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    return localStorage.getItem("lsv-gdrive-last-sync") || null;
  });
  const [gsiLoaded, setGsiLoaded] = useState(() => {
    return !!(window.google?.accounts?.oauth2);
  });
  const [fileId, setFileId] = useState(() => {
    return localStorage.getItem("lsv-gdrive-file-id") || null;
  });

  const tokenClientRef = useRef(null);

  // Cargar dinámicamente el script de Google Identity Services (GIS)
  useEffect(() => {
    if (gsiLoaded) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGsiLoaded(true);
      console.log("✅ SDK de Google Identity Services cargado con éxito");
    };
    script.onerror = () => {
      console.error("❌ Error cargando SDK de Google Identity Services");
      setSyncStatus("error");
    };
    document.body.appendChild(script);
  }, [gsiLoaded]);

  // Inicializar el cliente del token cuando GIS y el Client ID estén listos
  useEffect(() => {
    if (!gsiLoaded || !clientId) return;

    try {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response) => {
          if (response.error) {
            console.error("❌ Error en autenticación:", response);
            setSyncStatus("error");
            return;
          }

          if (response.access_token) {
            setAccessToken(response.access_token);
            sessionStorage.setItem("lsv-gdrive-token", response.access_token);
            setSyncStatus("connected");
            console.log("🔓 Google Drive autenticado con éxito");
          }
        },
      });
    } catch (err) {
      console.error("❌ Error al inicializar TokenClient:", err);
    }
  }, [gsiLoaded, clientId]);

  // Actualizar Client ID y guardarlo
  const updateClientId = useCallback((newId) => {
    setClientId(newId);
    if (newId) {
      localStorage.setItem("lsv-gdrive-client-id", newId);
    } else {
      localStorage.removeItem("lsv-gdrive-client-id");
    }
    // Desconectar sesión si cambia
    setAccessToken(null);
    sessionStorage.removeItem("lsv-gdrive-token");
    setSyncStatus("idle");
  }, []);

  // Iniciar sesión (abre el popup de Google)
  const login = useCallback(() => {
    if (!clientId) {
      alert("Por favor, configura un Google Client ID primero en los ajustes de Sincronización.");
      return;
    }

    if (!tokenClientRef.current) {
      // Re-inicializar si no está listo
      if (window.google?.accounts?.oauth2) {
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.file",
          callback: (response) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              sessionStorage.setItem("lsv-gdrive-token", response.access_token);
              setSyncStatus("connected");
            }
          },
        });
      }
    }

    if (tokenClientRef.current) {
      setSyncStatus("connecting");
      tokenClientRef.current.requestAccessToken({ prompt: "consent" });
    } else {
      alert("El SDK de Google está cargando. Inténtalo en un momento.");
    }
  }, [clientId]);

  // Cerrar sesión
  const logout = useCallback(() => {
    setAccessToken(null);
    sessionStorage.removeItem("lsv-gdrive-token");
    localStorage.removeItem("lsv-gdrive-file-id");
    setFileId(null);
    setSyncStatus("idle");
    console.log("🔒 Google Drive desconectado");
  }, []);

  // Buscar el archivo lsv_dataset.json en Google Drive
  const findBackupFile = useCallback(async (token) => {
    const query = encodeURIComponent("name='lsv_dataset.json' and trashed=false");
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Token expirado
          logout();
        }
        throw new Error("Error buscando archivo en Drive");
      }

      const data = await response.json();
      return data.files?.[0] || null;
    } catch (err) {
      console.error("❌ Error en findBackupFile:", err);
      return null;
    }
  }, [logout]);

  // Guardar/Sincronizar el dataset en Google Drive
  const syncDataset = useCallback(async (dataset) => {
    if (!accessToken) return false;

    setSyncStatus("syncing");
    try {
      let activeFileId = fileId;
      
      // Buscar el archivo si no lo tenemos en memoria/cache
      if (!activeFileId) {
        const file = await findBackupFile(accessToken);
        if (file) {
          activeFileId = file.id;
          setFileId(file.id);
          localStorage.setItem("lsv-gdrive-file-id", file.id);
        }
      }

      if (activeFileId) {
        // ACTUALIZAR contenido del archivo existente (PATCH)
        const response = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${activeFileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(dataset),
          }
        );

        if (!response.ok) {
          if (response.status === 401) logout();
          throw new Error("Fallo al actualizar el archivo");
        }
      } else {
        // CREAR el archivo desde cero (Paso 1: Metadata, Paso 2: Media)
        const metadataResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "lsv_dataset.json",
            mimeType: "application/json",
          }),
        });

        if (!metadataResponse.ok) {
          if (metadataResponse.status === 401) logout();
          throw new Error("Fallo al crear metadata");
        }

        const metadata = await metadataResponse.json();
        const newFileId = metadata.id;
        setFileId(newFileId);
        localStorage.setItem("lsv-gdrive-file-id", newFileId);

        // Subir contenido
        const contentResponse = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${newFileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(dataset),
          }
        );

        if (!contentResponse.ok) throw new Error("Fallo al subir contenido inicial");
      }

      // Actualizar hora de sincronización
      const nowStr = new Date().toLocaleTimeString();
      setLastSyncTime(nowStr);
      localStorage.setItem("lsv-gdrive-last-sync", nowStr);
      setSyncStatus("success");
      
      // Regresar a 'connected' tras un delay visual
      setTimeout(() => {
        setSyncStatus("connected");
      }, 2000);

      console.log("☁️ Dataset sincronizado en Google Drive con éxito");
      return true;
    } catch (err) {
      console.error("❌ Error en syncDataset:", err);
      setSyncStatus("error");
      return false;
    }
  }, [accessToken, fileId, findBackupFile, logout]);

  // Descargar el dataset desde Google Drive
  const downloadDataset = useCallback(async () => {
    if (!accessToken) return null;

    setSyncStatus("syncing");
    try {
      let activeFileId = fileId;

      if (!activeFileId) {
        const file = await findBackupFile(accessToken);
        if (file) {
          activeFileId = file.id;
          setFileId(file.id);
          localStorage.setItem("lsv-gdrive-file-id", file.id);
        } else {
          // No existe archivo de respaldo en su nube
          setSyncStatus("connected");
          return [];
        }
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${activeFileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) logout();
        throw new Error("Fallo al descargar dataset de Google Drive");
      }

      const data = await response.json();
      setSyncStatus("success");
      
      setTimeout(() => {
        setSyncStatus("connected");
      }, 2000);

      console.log("☁️ Dataset descargado desde Google Drive con éxito");
      return data;
    } catch (err) {
      console.error("❌ Error en downloadDataset:", err);
      setSyncStatus("error");
      return null;
    }
  }, [accessToken, fileId, findBackupFile, logout]);

  return {
    clientId,
    updateClientId,
    accessToken,
    syncStatus,
    lastSyncTime,
    login,
    logout,
    syncDataset,
    downloadDataset,
    isConnected: !!accessToken,
  };
}
