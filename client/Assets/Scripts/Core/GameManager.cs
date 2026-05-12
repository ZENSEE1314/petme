using System;
using UnityEngine;

namespace SmoothGiraffe.Core
{
    /// <summary>
    /// Global game-loop singleton. Lives across scenes.
    /// Owns ApiClient, AuthManager, TimeService, and the currently logged-in player.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Backend (auto-loaded from Resources/Config.json if present)")]
        [SerializeField] private string supabaseUrl = "";
        [SerializeField] private string supabaseAnonKey = "";

        public Net.ApiClient Api { get; private set; }
        public Net.AuthManager Auth { get; private set; }
        public TimeService Time { get; private set; }

        [Serializable]
        private class BackendConfig
        {
            public string supabaseUrl;
            public string supabaseAnonKey;
        }

        /// <summary>UUID of the currently logged-in user, or null if not signed in.</summary>
        public string CurrentUserId => Auth?.CurrentUserId;

        public event Action OnReady;
        public bool IsReady { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Auto-load from Resources/Config.json if Inspector fields are empty
            if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseAnonKey))
            {
                var configAsset = Resources.Load<TextAsset>("Config");
                if (configAsset != null)
                {
                    var cfg = JsonUtility.FromJson<BackendConfig>(configAsset.text);
                    if (!string.IsNullOrEmpty(cfg?.supabaseUrl)) supabaseUrl = cfg.supabaseUrl;
                    if (!string.IsNullOrEmpty(cfg?.supabaseAnonKey)) supabaseAnonKey = cfg.supabaseAnonKey;
                }
            }

            if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseAnonKey))
            {
                Debug.LogError(
                    "GameManager: backend config missing. " +
                    "Run scripts/setup.ps1, or set values in the Inspector, " +
                    "or place Config.json in client/Assets/Resources/.");
                return;
            }

            Api  = new Net.ApiClient(supabaseUrl, supabaseAnonKey);
            Auth = new Net.AuthManager(Api);
            Time = new TimeService(Api);
        }

        private async void Start()
        {
            // Restore session from PlayerPrefs if present
            await Auth.TryRestoreSessionAsync();
            // Sync server time once at boot to detect/avoid client-clock drift
            await Time.SyncWithServerAsync();

            IsReady = true;
            OnReady?.Invoke();
            Debug.Log($"GameManager ready. Signed-in user: {CurrentUserId ?? "<anonymous>"}");
        }
    }
}
