using UnityEngine;

namespace SmoothGiraffe.Pet
{
    /// <summary>
    /// Drives the placeholder pet GameObject — a cube for Phase 0.
    /// Gentle idle bob + Y-rotation so the scene doesn't feel dead.
    /// Replaced by real monster prefabs in Phase 2 once art lands.
    /// </summary>
    [RequireComponent(typeof(MeshRenderer))]
    public class PetController : MonoBehaviour
    {
        [Header("Idle motion")]
        [SerializeField] private float bobAmplitude = 0.08f;
        [SerializeField] private float bobFrequency = 1.4f;
        [SerializeField] private float spinDegreesPerSecond = 18f;

        [Header("State color tint (debug-friendly while no real art)")]
        [SerializeField] private Color happyColor = new(1f, 0.7f, 0.8f);  // pink
        [SerializeField] private Color hungryColor = new(0.6f, 0.6f, 0.6f); // grey
        [SerializeField] private Color sleepingColor = new(0.5f, 0.6f, 1f); // blue

        private Vector3 _basePosition;
        private MeshRenderer _renderer;
        private MaterialPropertyBlock _props;
        private float _phase;

        public PetState State { get; set; } = PetState.Happy;

        public enum PetState { Happy, Hungry, Sleeping }

        private void Awake()
        {
            _basePosition = transform.localPosition;
            _renderer = GetComponent<MeshRenderer>();
            _props = new MaterialPropertyBlock();
            _phase = Random.value * Mathf.PI * 2f; // varied per pet
        }

        private void Update()
        {
            // Bob
            var t = Time.time * bobFrequency + _phase;
            var bob = Mathf.Sin(t) * bobAmplitude;
            transform.localPosition = _basePosition + new Vector3(0, bob, 0);

            // Spin
            transform.Rotate(Vector3.up, spinDegreesPerSecond * Time.deltaTime, Space.World);

            // Color hint
            _renderer.GetPropertyBlock(_props);
            _props.SetColor("_BaseColor", ColorForState());
            _props.SetColor("_Color", ColorForState()); // Standard shader fallback
            _renderer.SetPropertyBlock(_props);
        }

        private Color ColorForState() => State switch
        {
            PetState.Hungry => hungryColor,
            PetState.Sleeping => sleepingColor,
            _ => happyColor,
        };
    }
}
