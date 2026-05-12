using System;
using System.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace SmoothGiraffe.Core
{
    /// <summary>
    /// Drives the Boot scene flow:
    /// 1. Wait for GameManager.OnReady
    /// 2. If not signed in → show sign-up panel
    /// 3. After sign-in → fetch user's monsters
    ///    - 0 monsters → show "pick a starter" panel
    ///    - 1+ monsters → show first monster as placeholder cube
    /// 4. Constantly display the user's currency balances
    ///
    /// Wired by Editor/BootSceneSetup.cs — no manual scene editing needed.
    /// </summary>
    public class BootController : MonoBehaviour
    {
        [Header("UI — Status")]
        [SerializeField] private TextMeshProUGUI statusText;
        [SerializeField] private TextMeshProUGUI userIdText;
        [SerializeField] private TextMeshProUGUI balancesText;

        [Header("UI — Sign-in panel")]
        [SerializeField] private GameObject signInPanel;
        [SerializeField] private TMP_InputField emailField;
        [SerializeField] private TMP_InputField passwordField;
        [SerializeField] private TMP_InputField displayNameField;
        [SerializeField] private Button signUpButton;
        [SerializeField] private Button signInButton;
        [SerializeField] private Button anonButton;

        [Header("UI — Starter picker")]
        [SerializeField] private GameObject starterPanel;
        [SerializeField] private Button starterFireButton;
        [SerializeField] private Button starterWaterButton;
        [SerializeField] private Button starterGrassButton;

        [Header("Scene")]
        [SerializeField] private PetController petPlaceholder;

        private void Start()
        {
            HideAllPanels();
            SetStatus("Booting…");

            if (GameManager.Instance == null)
            {
                SetStatus("ERROR: no GameManager in scene");
                return;
            }

            if (GameManager.Instance.IsReady) OnReady();
            else GameManager.Instance.OnReady += OnReady;

            WireButtons();
        }

        private void WireButtons()
        {
            signUpButton.onClick.AddListener(() => _ = SignUpAsync());
            signInButton.onClick.AddListener(() => _ = SignInAsync());
            anonButton.onClick.AddListener(() => _ = SignInAnonAsync());
            starterFireButton.onClick.AddListener(() => _ = ClaimStarterAsync(1));   // Emberlet
            starterWaterButton.onClick.AddListener(() => _ = ClaimStarterAsync(4));  // Bubblet
            starterGrassButton.onClick.AddListener(() => _ = ClaimStarterAsync(7));  // Seedling
        }

        private async void OnReady()
        {
            SetStatus("Connecting to Supabase…");
            var auth = GameManager.Instance.Auth;

            if (!auth.IsSignedIn)
            {
                ShowSignInPanel();
                return;
            }
            await PostSignInAsync();
        }

        private async Task PostSignInAsync()
        {
            SetStatus("Loading your collection…");
            userIdText.text = $"signed in as {GameManager.Instance.CurrentUserId.Substring(0, 8)}…";

            await RefreshBalancesAsync();
            await ShowOwnedOrStarterAsync();
        }

        // ----------------------------------------------------------
        // Auth handlers
        // ----------------------------------------------------------

        private async Task SignUpAsync()
        {
            try
            {
                SetStatus("Signing up…");
                await GameManager.Instance.Auth.SignUpWithEmailAsync(
                    emailField.text.Trim(),
                    passwordField.text,
                    string.IsNullOrWhiteSpace(displayNameField.text) ? null : displayNameField.text.Trim());
                await PostSignInAsync();
            }
            catch (Exception e) { SetStatus($"Sign-up failed: {e.Message}"); }
        }

        private async Task SignInAsync()
        {
            try
            {
                SetStatus("Signing in…");
                await GameManager.Instance.Auth.SignInWithEmailAsync(
                    emailField.text.Trim(),
                    passwordField.text);
                await PostSignInAsync();
            }
            catch (Exception e) { SetStatus($"Sign-in failed: {e.Message}"); }
        }

        private async Task SignInAnonAsync()
        {
            try
            {
                SetStatus("Creating anonymous session…");
                await GameManager.Instance.Auth.SignInAnonymouslyAsync();
                await PostSignInAsync();
            }
            catch (Exception e) { SetStatus($"Anon sign-in failed: {e.Message}"); }
        }

        // ----------------------------------------------------------
        // Game data
        // ----------------------------------------------------------

        private async Task RefreshBalancesAsync()
        {
            try
            {
                var api = GameManager.Instance.Api;
                var bal = await api.SelectArrayAsync<UserBalances>(
                    "user_balances",
                    $"select=coins,gems,stardust,tickets&user_id=eq.{GameManager.Instance.CurrentUserId}");
                if (bal.Length > 0)
                    balancesText.text = $"🪙 {bal[0].coins}   💎 {bal[0].gems}   ✨ {bal[0].stardust}   🎟️ {bal[0].tickets}";
                else
                    balancesText.text = "🪙 0   💎 0   ✨ 0   🎟️ 0";
            }
            catch (Exception e)
            {
                balancesText.text = $"(balances unavailable: {e.Message})";
            }
        }

        private async Task ShowOwnedOrStarterAsync()
        {
            try
            {
                var api = GameManager.Instance.Api;
                var monsters = await api.SelectArrayAsync<MonsterRow>(
                    "monsters",
                    $"select=id,species_id,nickname,hp,mood&owner_id=eq.{GameManager.Instance.CurrentUserId}");
                if (monsters.Length == 0)
                {
                    SetStatus("Pick a starter!");
                    ShowStarterPanel();
                    return;
                }

                var m = monsters[0];
                SetStatus($"Your pet — species #{m.species_id}, mood {m.mood}/100");
                HideAllPanels();
                if (petPlaceholder != null) petPlaceholder.gameObject.SetActive(true);
            }
            catch (Exception e)
            {
                SetStatus($"Could not load monsters: {e.Message}");
            }
        }

        private async Task ClaimStarterAsync(int speciesId)
        {
            try
            {
                SetStatus("Claiming starter…");
                var req = new ClaimStarterRequest { species_id = speciesId };
                var resp = await GameManager.Instance.Api.CallFunctionAsync<ClaimStarterRequest, ClaimStarterResponse>(
                    "claim-starter", req);
                if (!string.IsNullOrEmpty(resp.error)) { SetStatus($"Failed: {resp.error}"); return; }
                SetStatus($"Welcome to your new pet! (species {resp.species_id})");
                await RefreshBalancesAsync();
                await ShowOwnedOrStarterAsync();
            }
            catch (Exception e) { SetStatus($"Claim failed: {e.Message}"); }
        }

        // ----------------------------------------------------------
        // UI helpers
        // ----------------------------------------------------------

        private void SetStatus(string s)
        {
            if (statusText != null) statusText.text = s;
            Debug.Log($"[Boot] {s}");
        }

        private void HideAllPanels()
        {
            if (signInPanel != null) signInPanel.SetActive(false);
            if (starterPanel != null) starterPanel.SetActive(false);
            if (petPlaceholder != null) petPlaceholder.gameObject.SetActive(false);
        }

        private void ShowSignInPanel()
        {
            HideAllPanels();
            SetStatus("Sign in to start.");
            if (signInPanel != null) signInPanel.SetActive(true);
        }

        private void ShowStarterPanel()
        {
            HideAllPanels();
            if (starterPanel != null) starterPanel.SetActive(true);
        }

        // ----------------------------------------------------------
        // DTOs
        // ----------------------------------------------------------

        private class UserBalances
        {
            public int coins; public int gems; public int stardust; public int tickets;
        }
        private class MonsterRow
        {
            public string id; public int species_id; public string nickname;
            public int hp; public int mood;
        }
        private class ClaimStarterRequest { public int species_id; }
        private class ClaimStarterResponse
        {
            public string monster_id; public int species_id; public string species_name; public string error;
        }
    }
}
