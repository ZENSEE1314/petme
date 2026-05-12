using System;
using UnityEngine;

namespace SmoothGiraffe.Pet
{
    /// <summary>
    /// Client-side state model for a single owned monster.
    /// Mirrors the `monsters` table row 1:1 — keep field names in sync.
    /// Care actions hit edge functions on the server; the server returns
    /// the new state and this object updates locally.
    /// </summary>
    [Serializable]
    public class PetState
    {
        public string id;
        public string owner_id;
        public int species_id;
        public string nickname;
        public bool is_starter;
        public bool is_shiny;

        public int level;
        public int xp;
        public int hp;
        public int atk;
        public int def;
        public int spd;
        public int intl;

        public int hunger;
        public int cleanliness;
        public int energy;
        public int mood;
        public string last_tick_at;

        public string trade_locked_until;

        // ----------------------------------------------------------
        // Derived state (computed locally, never stored on server)
        // ----------------------------------------------------------

        public bool IsHungry      => hunger < 30;
        public bool IsDirty       => cleanliness < 30;
        public bool IsTired       => energy < 30;
        public bool NeedsAttention => IsHungry || IsDirty || IsTired || mood < 30;

        public bool CanBeTraded
        {
            get
            {
                if (is_starter) return false;
                if (string.IsNullOrEmpty(trade_locked_until)) return true;
                return DateTime.Parse(trade_locked_until).ToUniversalTime() <= DateTime.UtcNow;
            }
        }

        /// <summary>Display name — nickname falls back to species fetch.</summary>
        public string DisplayName => string.IsNullOrEmpty(nickname) ? $"Pet #{species_id}" : nickname;
    }
}
