using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace SmoothGiraffe.Net
{
    /// <summary>
    /// Wraps Supabase Auth REST endpoints.
    /// Persists access + refresh tokens in PlayerPrefs.
    /// Updates ApiClient bearer on sign-in / sign-out.
    /// </summary>
    public class AuthManager
    {
        private const string ACCESS_TOKEN_PREF = "supabase_access_token";
        private const string REFRESH_TOKEN_PREF = "supabase_refresh_token";
        private const string USER_ID_PREF = "supabase_user_id";

        private readonly ApiClient _api;
        private readonly HttpClient _http;

        public string CurrentUserId { get; private set; }
        public bool IsSignedIn => !string.IsNullOrEmpty(CurrentUserId);

        public event Action<string> OnSignedIn;
        public event Action OnSignedOut;

        public AuthManager(ApiClient api)
        {
            _api = api;
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
            _http.DefaultRequestHeaders.Add("apikey", api.AnonKey);
        }

        public async Task TryRestoreSessionAsync()
        {
            var refresh = PlayerPrefs.GetString(REFRESH_TOKEN_PREF, null);
            if (string.IsNullOrEmpty(refresh))
            {
                Debug.Log("AuthManager: no stored session.");
                return;
            }
            try
            {
                await RefreshAsync(refresh);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"AuthManager: session refresh failed → signed out. {e.Message}");
                SignOut();
            }
        }

        public async Task SignInAnonymouslyAsync()
        {
            var url = $"{_api.BaseUrl}/auth/v1/signup";
            var payload = "{\"email\":null}"; // Supabase anonymous sign-in
            await PostAuthAsync(url, payload);
        }

        public async Task SignInWithEmailAsync(string email, string password)
        {
            var url = $"{_api.BaseUrl}/auth/v1/token?grant_type=password";
            var payload = $"{{\"email\":\"{email}\",\"password\":\"{password}\"}}";
            await PostAuthAsync(url, payload);
        }

        public async Task SignUpWithEmailAsync(string email, string password, string displayName)
        {
            var url = $"{_api.BaseUrl}/auth/v1/signup";
            var payload = $"{{\"email\":\"{email}\",\"password\":\"{password}\",\"data\":{{\"display_name\":\"{displayName}\"}}}}";
            await PostAuthAsync(url, payload);
        }

        public void SignOut()
        {
            PlayerPrefs.DeleteKey(ACCESS_TOKEN_PREF);
            PlayerPrefs.DeleteKey(REFRESH_TOKEN_PREF);
            PlayerPrefs.DeleteKey(USER_ID_PREF);
            PlayerPrefs.Save();

            _api.SetAccessToken(null);
            CurrentUserId = null;
            OnSignedOut?.Invoke();
        }

        // ----------------------------------------------------------
        // Internals
        // ----------------------------------------------------------

        private async Task RefreshAsync(string refreshToken)
        {
            var url = $"{_api.BaseUrl}/auth/v1/token?grant_type=refresh_token";
            var payload = $"{{\"refresh_token\":\"{refreshToken}\"}}";
            await PostAuthAsync(url, payload);
        }

        private async Task PostAuthAsync(string url, string payload)
        {
            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var resp = await _http.PostAsync(url, content);
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
                throw new ApiException(resp.StatusCode, body);

            var session = JsonUtility.FromJson<AuthSession>(body);
            if (string.IsNullOrEmpty(session.access_token))
                throw new InvalidOperationException("auth response missing access_token");

            PlayerPrefs.SetString(ACCESS_TOKEN_PREF, session.access_token);
            PlayerPrefs.SetString(REFRESH_TOKEN_PREF, session.refresh_token);
            PlayerPrefs.SetString(USER_ID_PREF, session.user.id);
            PlayerPrefs.Save();

            _api.SetAccessToken(session.access_token);
            CurrentUserId = session.user.id;
            OnSignedIn?.Invoke(CurrentUserId);
        }

        [Serializable]
        private class AuthSession
        {
            public string access_token;
            public string refresh_token;
            public AuthUser user;
        }

        [Serializable]
        private class AuthUser
        {
            public string id;
            public string email;
        }
    }
}
