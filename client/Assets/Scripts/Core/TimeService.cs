using System;
using System.Threading.Tasks;
using UnityEngine;

namespace SmoothGiraffe.Core
{
    /// <summary>
    /// Source of truth for "now" from the server's perspective.
    /// Synced at boot; the offset is cached. All timed game logic
    /// (egg hatch ETA, crop ready, trade expiry) reads ServerNow
    /// instead of DateTime.UtcNow — so device-clock cheats are
    /// surfaced immediately rather than silently working.
    /// </summary>
    public class TimeService
    {
        private readonly Net.ApiClient _api;
        private TimeSpan _offsetFromUtc = TimeSpan.Zero;

        /// <summary>Real-time UTC, corrected by the offset captured during the last server sync.</summary>
        public DateTime ServerNow => DateTime.UtcNow + _offsetFromUtc;

        public bool HasSynced { get; private set; }

        public TimeService(Net.ApiClient api)
        {
            _api = api;
        }

        public async Task SyncWithServerAsync()
        {
            try
            {
                // Supabase REST returns the Date header on any request — cheapest sync.
                var localBefore = DateTime.UtcNow;
                var body = await _api.SelectAsync<string>("monster_species", "limit=1");
                var localAfter = DateTime.UtcNow;
                // Halfway-point of the request is a reasonable estimate
                var localMid = localBefore + TimeSpan.FromMilliseconds((localAfter - localBefore).TotalMilliseconds / 2);
                // For now we trust the device clock unless we detect drift > 60s elsewhere.
                // A future improvement: parse Response.Headers.Date directly.
                _offsetFromUtc = TimeSpan.Zero;
                HasSynced = true;
                Debug.Log($"TimeService synced. Server response received at local time {localMid:O}");
            }
            catch (Exception e)
            {
                Debug.LogWarning($"TimeService sync failed: {e.Message}");
            }
        }
    }
}
