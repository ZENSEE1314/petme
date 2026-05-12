using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using UnityEngine;

namespace SmoothGiraffe.Net
{
    /// <summary>
    /// Thin wrapper around Supabase REST + Edge Functions.
    /// One shared HttpClient instance. Bearer token is set/cleared by AuthManager.
    ///
    /// Requires the Newtonsoft.Json Unity package
    /// (com.unity.nuget.newtonsoft-json). JsonUtility is too limited for
    /// PostgREST responses (top-level arrays, nullables, dictionaries).
    /// </summary>
    public class ApiClient
    {
        private readonly string _baseUrl;
        private readonly string _anonKey;
        private readonly HttpClient _http;

        public string BaseUrl => _baseUrl;
        public string AnonKey => _anonKey;

        public ApiClient(string baseUrl, string anonKey)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _anonKey = anonKey;
            _http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            _http.DefaultRequestHeaders.Add("apikey", anonKey);
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        /// <summary>Set/clear bearer token. Called by AuthManager on sign-in / sign-out.</summary>
        public void SetAccessToken(string accessToken)
        {
            _http.DefaultRequestHeaders.Authorization = string.IsNullOrEmpty(accessToken)
                ? null
                : new AuthenticationHeaderValue("Bearer", accessToken);
        }

        // ----------------------------------------------------------
        // PostgREST helpers
        // ----------------------------------------------------------

        /// <summary>GET a single row or RPC result (returns whatever the response shape is).</summary>
        public async Task<T> SelectOneAsync<T>(string table, string query)
        {
            var url = $"{_baseUrl}/rest/v1/{table}?{query}";
            using var resp = await _http.GetAsync(url);
            return await DeserializeOrThrow<T>(resp);
        }

        /// <summary>GET an array of rows.</summary>
        public async Task<T[]> SelectArrayAsync<T>(string table, string query)
        {
            var url = $"{_baseUrl}/rest/v1/{table}?{query}";
            using var resp = await _http.GetAsync(url);
            return await DeserializeOrThrow<T[]>(resp);
        }

        // ----------------------------------------------------------
        // Edge functions
        // ----------------------------------------------------------

        /// <summary>POST to an edge function with a typed request, get a typed response.</summary>
        public async Task<TResponse> CallFunctionAsync<TRequest, TResponse>(string functionName, TRequest body)
        {
            var url = $"{_baseUrl}/functions/v1/{functionName}";
            var json = JsonConvert.SerializeObject(body);
            return await PostAsync<TResponse>(url, json);
        }

        /// <summary>POST to an edge function with no body wrapper.</summary>
        public async Task<TResponse> CallFunctionAsync<TResponse>(string functionName)
        {
            var url = $"{_baseUrl}/functions/v1/{functionName}";
            return await PostAsync<TResponse>(url, "{}");
        }

        // ----------------------------------------------------------
        // Internals
        // ----------------------------------------------------------

        private async Task<T> PostAsync<T>(string url, string jsonBody)
        {
            using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
            using var resp = await _http.PostAsync(url, content);
            return await DeserializeOrThrow<T>(resp);
        }

        private static async Task<T> DeserializeOrThrow<T>(HttpResponseMessage resp)
        {
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                Debug.LogError($"ApiClient {(int)resp.StatusCode}: {body}");
                throw new ApiException(resp.StatusCode, body);
            }
            if (typeof(T) == typeof(string)) return (T)(object)body;
            if (string.IsNullOrWhiteSpace(body)) return default;
            try
            {
                return JsonConvert.DeserializeObject<T>(body);
            }
            catch (Exception e)
            {
                throw new ApiException(resp.StatusCode, $"deserialize failed: {e.Message}\n{body}");
            }
        }
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
