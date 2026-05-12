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

        [Header("Backend")]
        [SerializeField] private string supabaseUrl = "";       // set from Supabase project Settings → API
        [SerializeField] private string supabaseAnonKey = "";

        public Net.ApiClient Api { get; private set; }
        public Net.AuthManager Auth { get; private set; }
        public TimeService Time { get; private set; }

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

            if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseAnonKey))
            {
                Debug.LogError("GameManager: supabaseUrl and supabaseAnonKey must be set in the Inspector.");
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
