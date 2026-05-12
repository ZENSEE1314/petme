#if UNITY_EDITOR
using SmoothGiraffe.Core;
using SmoothGiraffe.Pet;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace SmoothGiraffe.EditorTools
{
    /// <summary>
    /// One-click Boot scene builder.
    /// Menu: Smooth Giraffe → Create Boot Scene
    /// Builds everything programmatically — camera, light, placeholder cube,
    /// UI canvas with status text + sign-in panel + starter picker — and
    /// wires the BootController serialized fields automatically.
    /// </summary>
    public static class BootSceneSetup
    {
        private const string SCENE_PATH = "Assets/Scenes/Boot.unity";

        [MenuItem("Smooth Giraffe/Create Boot Scene")]
        public static void Build()
        {
            // Confirm overwrite if the scene already exists
            if (System.IO.File.Exists(SCENE_PATH))
            {
                if (!EditorUtility.DisplayDialog(
                    "Boot scene exists",
                    $"{SCENE_PATH} already exists. Overwrite?",
                    "Overwrite", "Cancel"))
                    return;
            }

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            BuildCamera();
            BuildLight();
            var pet = BuildPlaceholderPet();
            var (boot, status, userId, balances, signIn, starter, fields) = BuildUI();
            BuildGameManager();
            BuildBootController(boot, status, userId, balances, signIn, starter, fields, pet);

            EnsureFolder("Assets/Scenes");
            EditorSceneManager.SaveScene(scene, SCENE_PATH);

            // Add to Build Settings as scene 0
            var existing = EditorBuildSettings.scenes;
            foreach (var s in existing) if (s.path == SCENE_PATH) return;
            var updated = new EditorBuildSettingsScene[existing.Length + 1];
            updated[0] = new EditorBuildSettingsScene(SCENE_PATH, true);
            for (int i = 0; i < existing.Length; i++) updated[i + 1] = existing[i];
            EditorBuildSettings.scenes = updated;

            Debug.Log($"✔ Boot scene created at {SCENE_PATH}. Press Play to run.");
            EditorUtility.DisplayDialog(
                "Boot scene ready",
                "Boot.unity created and added to Build Settings as scene 0.\n\n" +
                "Make sure Config.json is in Assets/Resources/ (run scripts/setup.ps1 if not), " +
                "then press Play.",
                "OK");
        }

        // ----------------------------------------------------------
        // Scene parts
        // ----------------------------------------------------------

        private static void BuildCamera()
        {
            var cam = new GameObject("Main Camera",
                typeof(Camera), typeof(AudioListener)).GetComponent<Camera>();
            cam.tag = "MainCamera";
            cam.transform.position = new Vector3(0, 1.4f, -3.5f);
            cam.transform.rotation = Quaternion.Euler(15f, 0, 0);
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.92f, 0.88f, 0.96f); // soft lavender
            cam.fieldOfView = 50f;
        }

        private static void BuildLight()
        {
            var lightGO = new GameObject("Directional Light", typeof(Light));
            var l = lightGO.GetComponent<Light>();
            l.type = LightType.Directional;
            l.color = new Color(1f, 0.97f, 0.9f);
            l.intensity = 1.05f;
            lightGO.transform.rotation = Quaternion.Euler(45f, -25f, 0);
        }

        private static PetController BuildPlaceholderPet()
        {
            // Floor
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "Floor";
            floor.transform.position = Vector3.zero;
            floor.transform.localScale = new Vector3(0.4f, 1f, 0.4f);
            var floorMat = new Material(Shader.Find("Standard")) { color = new Color(0.95f, 0.85f, 0.75f) };
            floor.GetComponent<MeshRenderer>().sharedMaterial = floorMat;

            // Cube pet
            var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.name = "Pet (placeholder)";
            cube.transform.position = new Vector3(0, 0.5f, 0);
            cube.transform.localScale = Vector3.one * 0.7f;
            var cubeMat = new Material(Shader.Find("Standard")) { color = new Color(1f, 0.7f, 0.8f) };
            cube.GetComponent<MeshRenderer>().sharedMaterial = cubeMat;
            var pet = cube.AddComponent<PetController>();
            cube.SetActive(false); // shown once user has a monster
            return pet;
        }

        private static void BuildGameManager()
        {
            var go = new GameObject("GameManager");
            go.AddComponent<GameManager>();
        }

        // ----------------------------------------------------------
        // UI canvas
        // ----------------------------------------------------------

        private struct StarterButtons { public Button fire, water, grass; }
        private struct SignInFields { public TMP_InputField email, password, displayName; public Button signUp, signIn, anon; }

        private static (BootController, TextMeshProUGUI, TextMeshProUGUI, TextMeshProUGUI,
                       GameObject, GameObject, (SignInFields, StarterButtons))
            BuildUI()
        {
            // Canvas
            var canvasGO = new GameObject("Canvas",
                typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGO.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGO.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);

            // EventSystem
            if (Object.FindObjectOfType<EventSystem>() == null)
            {
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            }

            // Status text (top bar)
            var status = MakeText(canvas.transform, "StatusText", "Booting…", 36,
                new Vector2(0, -40), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(900, 60));

            // User id (top right small)
            var userId = MakeText(canvas.transform, "UserIdText", "", 20,
                new Vector2(-20, -20), new Vector2(1, 1), new Vector2(1, 1), new Vector2(400, 30));
            userId.alignment = TextAlignmentOptions.TopRight;

            // Balances (top left)
            var balances = MakeText(canvas.transform, "BalancesText", "🪙 0   💎 0   ✨ 0   🎟️ 0", 24,
                new Vector2(20, -20), new Vector2(0, 1), new Vector2(0, 1), new Vector2(500, 30));
            balances.alignment = TextAlignmentOptions.TopLeft;

            // Sign-in panel
            var signInPanel = MakePanel(canvas.transform, "SignInPanel", new Vector2(600, 480));
            var emailField = MakeInputField(signInPanel.transform, "EmailField", "email", new Vector2(0, 140));
            var passwordField = MakeInputField(signInPanel.transform, "PasswordField", "password", new Vector2(0, 70));
            passwordField.contentType = TMP_InputField.ContentType.Password;
            var dispField = MakeInputField(signInPanel.transform, "DisplayNameField", "display name (sign-up only)", new Vector2(0, 0));
            var signUpBtn = MakeButton(signInPanel.transform, "SignUpBtn", "Sign Up", new Vector2(-150, -80));
            var signInBtn = MakeButton(signInPanel.transform, "SignInBtn", "Sign In", new Vector2(0, -80));
            var anonBtn   = MakeButton(signInPanel.transform, "AnonBtn",   "Anon",    new Vector2(150, -80));

            // Starter panel
            var starterPanel = MakePanel(canvas.transform, "StarterPanel", new Vector2(700, 400));
            MakeText(starterPanel.transform, "Title", "Pick your starter!", 40,
                new Vector2(0, 130), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(600, 60));
            var fireBtn  = MakeButton(starterPanel.transform, "FireBtn",  "🔥 Emberlet",  new Vector2(-220, 0));
            var waterBtn = MakeButton(starterPanel.transform, "WaterBtn", "💧 Bubblet",  new Vector2(0, 0));
            var grassBtn = MakeButton(starterPanel.transform, "GrassBtn", "🌿 Seedling", new Vector2(220, 0));

            // BootController GameObject (attach script after creating GO so we can pass it)
            var bootGO = new GameObject("BootController");
            var boot = bootGO.AddComponent<BootController>();

            return (boot, status, userId, balances, signInPanel, starterPanel,
                    (new SignInFields
                    {
                        email = emailField, password = passwordField, displayName = dispField,
                        signUp = signUpBtn, signIn = signInBtn, anon = anonBtn
                    },
                    new StarterButtons { fire = fireBtn, water = waterBtn, grass = grassBtn }));
        }

        // ----------------------------------------------------------
        // Wire the BootController's [SerializeField] private fields
        // ----------------------------------------------------------

        private static void BuildBootController(
            BootController boot,
            TextMeshProUGUI status, TextMeshProUGUI userId, TextMeshProUGUI balances,
            GameObject signIn, GameObject starter, (SignInFields, StarterButtons) fields,
            PetController pet)
        {
            var so = new SerializedObject(boot);
            void Set(string name, Object value) => so.FindProperty(name).objectReferenceValue = value;

            Set("statusText", status);
            Set("userIdText", userId);
            Set("balancesText", balances);
            Set("signInPanel", signIn);
            Set("emailField", fields.Item1.email);
            Set("passwordField", fields.Item1.password);
            Set("displayNameField", fields.Item1.displayName);
            Set("signUpButton", fields.Item1.signUp);
            Set("signInButton", fields.Item1.signIn);
            Set("anonButton", fields.Item1.anon);
            Set("starterPanel", starter);
            Set("starterFireButton", fields.Item2.fire);
            Set("starterWaterButton", fields.Item2.water);
            Set("starterGrassButton", fields.Item2.grass);
            Set("petPlaceholder", pet);

            so.ApplyModifiedProperties();
        }

        // ----------------------------------------------------------
        // Tiny UI helpers
        // ----------------------------------------------------------

        private static TextMeshProUGUI MakeText(Transform parent, string name, string text, float size,
            Vector2 pos, Vector2 anchorMin, Vector2 anchorMax, Vector2 sizeDelta)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = anchorMin; rt.anchorMax = anchorMax;
            rt.anchoredPosition = pos; rt.sizeDelta = sizeDelta;
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.text = text;
            tmp.fontSize = size;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = Color.black;
            return tmp;
        }

        private static GameObject MakePanel(Transform parent, string name, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = Vector2.zero;
            rt.sizeDelta = size;
            go.GetComponent<Image>().color = new Color(1f, 1f, 1f, 0.92f);
            return go;
        }

        private static TMP_InputField MakeInputField(Transform parent, string name, string placeholder, Vector2 pos)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(TMP_InputField));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(400, 50);
            go.GetComponent<Image>().color = new Color(0.96f, 0.96f, 0.96f);

            var input = go.GetComponent<TMP_InputField>();

            var text = MakeText(go.transform, "Text", "", 24,
                Vector2.zero, new Vector2(0, 0), new Vector2(1, 1), Vector2.zero);
            text.alignment = TextAlignmentOptions.Left;
            text.margin = new Vector4(10, 0, 10, 0);

            var ph = MakeText(go.transform, "Placeholder", placeholder, 24,
                Vector2.zero, new Vector2(0, 0), new Vector2(1, 1), Vector2.zero);
            ph.alignment = TextAlignmentOptions.Left;
            ph.color = new Color(0.55f, 0.55f, 0.55f);
            ph.margin = new Vector4(10, 0, 10, 0);

            input.textComponent = text;
            input.placeholder = ph;
            return input;
        }

        private static Button MakeButton(Transform parent, string name, string label, Vector2 pos)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = pos; rt.sizeDelta = new Vector2(180, 60);
            go.GetComponent<Image>().color = new Color(0.4f, 0.65f, 0.95f);
            MakeText(go.transform, "Label", label, 24,
                Vector2.zero, new Vector2(0, 0), new Vector2(1, 1), Vector2.zero).color = Color.white;
            return go.GetComponent<Button>();
        }

        private static void EnsureFolder(string path)
        {
            if (!AssetDatabase.IsValidFolder(path))
            {
                var parts = path.Split('/');
                var cur = parts[0];
                for (int i = 1; i < parts.Length; i++)
                {
                    var next = $"{cur}/{parts[i]}";
                    if (!AssetDatabase.IsValidFolder(next))
                        AssetDatabase.CreateFolder(cur, parts[i]);
                    cur = next;
                }
            }
        }
    }
}
#endif
