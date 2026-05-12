using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using UnityEngine;

namespace SmoothGiraffe.Net
{
    /// <summary>
    /// Thin wrapper around Supabase REST + Edge Functions.
    /// One shared HttpClient instance. Bearer token is set/cleared by AuthManager.
    /// </summary>
    public class ApiClient
    {
        private readonly string _baseUrl;       // e.g. https://abc.supabase.co
        private readonly string _anonKey;
        private readonly HttpClient _http;

        public ApiClient(string baseUrl, string anonKey)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _anonKey = anonKey;
            _http = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(20)
            };
            _http.DefaultRequestHeaders.Add("apikey", anonKey);
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        /// <summary>Set/clear bearer token on every request after sign-in / sign-out.</summary>
        public void SetAccessToken(string accessToken)
        {
            if (string.IsNullOrEmpty(accessToken))
                _http.DefaultRequestHeaders.Authorization = null;
            else
                _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }

        /// <summary>POST to an edge function, returning the JSON response body as a typed object.</summary>
        public async Task<TResponse> CallFunctionAsync<TRequest, TResponse>(string functionName, TRequest body)
        {
            var url = $"{_baseUrl}/functions/v1/{functionName}";
            var payload = JsonUtility.ToJson(body ?? throw new ArgumentNullException(nameof(body)));
            return await PostAsync<TResponse>(url, payload);
        }

        /// <summary>POST to an edge function with no typed body wrapper.</summary>
        public async Task<TResponse> CallFunctionAsync<TResponse>(string functionName, string jsonBody)
        {
            var url = $"{_baseUrl}/functions/v1/{functionName}";
            return await PostAsync<TResponse>(url, jsonBody);
        }

        /// <summary>Raw GET against the auto-generated PostgREST endpoint.</summary>
        public async Task<TResponse> SelectAsync<TResponse>(string table, string query = "")
        {
            var url = $"{_baseUrl}/rest/v1/{table}?{query}";
            using var resp = await _http.GetAsync(url);
            return await DeserializeOrThrow<TResponse>(resp);
        }

        // ----------------------------------------------------------
        // Internals
        // ----------------------------------------------------------

        private async Task<T> PostAsync<T>(string url, string jsonBody)
        {
            var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
            using var resp = await _http.PostAsync(url, content);
            return await DeserializeOrThrow<T>(resp);
        }

        private static async Task<T> DeserializeOrThrow<T>(HttpResponseMessage resp)
        {
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                Debug.LogError($"ApiClient {resp.StatusCode}: {body}");
                throw new ApiException(resp.StatusCode, body);
            }
            if (typeof(T) == typeof(string)) return (T)(object)body;
            try
            {
                return JsonUtility.FromJson<T>(body);
            }
            catch (Exception e)
            {
                throw new ApiException(resp.StatusCode, $"deserialize failed: {e.Message}\n{body}");
            }
        }

        // Helper for raw header access (used by AuthManager to read refresh tokens)
        internal Dictionary<string, string> Headers { get; } = new();

        public string BaseUrl => _baseUrl;
        public string AnonKey => _anonKey;
    }

    public class ApiException : Exception
    {
        public System.Net.HttpStatusCode StatusCode { get; }
        public string Body { get; }
        public ApiException(System.Net.HttpStatusCode statusCode, string body)
            : base($"API {statusCode}: {body}")
        {
            StatusCode = statusCode;
            Body = body;
        }
    }
}
