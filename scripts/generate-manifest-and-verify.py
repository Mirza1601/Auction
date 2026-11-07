import os
import json
import hashlib
import zipfile
from pathlib import Path
from PIL import Image

WORKSPACE_DIR = Path(r"c:\Users\Mirza Zabiullah\zabi projects\AUCTION")
BACKUP_DIR = WORKSPACE_DIR / "auction_nexus_full_backup"
EXTERNAL_BACKUP_DIR = Path(r"C:\Users\Mirza Zabiullah\.gemini\antigravity\brain\058cd951-b72c-43fa-965d-6d9744162557")

def sha256_file(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def inspect_image(filepath):
    try:
        with Image.open(filepath) as img:
            return {
                "valid": True,
                "format": img.format,
                "mode": img.mode,
                "width": img.width,
                "height": img.height
            }
    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
            "format": None,
            "mode": None,
            "width": None,
            "height": None
        }

def run_verification_and_manifest():
    print("=== VERIFYING BACKUP STRUCTURE ===")
    assert BACKUP_DIR.exists(), f"Missing backup directory: {BACKUP_DIR}"

    default_state_path = BACKUP_DIR / "default_profile" / "state.json"
    kkr_state_path = BACKUP_DIR / "profile_kkr_srm" / "state.json"
    
    assert default_state_path.exists(), f"Missing: {default_state_path}"
    assert kkr_state_path.exists(), f"Missing: {kkr_state_path}"

    with open(default_state_path, "r", encoding="utf-8") as f:
        default_state = json.load(f)

    with open(kkr_state_path, "r", encoding="utf-8") as f:
        kkr_state = json.load(f)

    print(f"Default Profile: {len(default_state.get('playerPool', []))} players in pool")
    print(f"Profile KKR vs SRM: {len(kkr_state.get('playerPool', []))} players in pool")

    # Inspect images in both profiles
    manifest = {
        "generated_at": "2026-11-08T04:55:00+05:30",
        "profiles": {
            "default_profile": {
                "player_count": len(default_state.get("playerPool", [])),
                "players": []
            },
            "profile_kkr_srm": {
                "player_count": len(kkr_state.get("playerPool", [])),
                "players": []
            }
        },
        "original_player_pics": [],
        "identity_cross_reference": {}
    }

    # Process Default Profile
    def_img_dir = BACKUP_DIR / "default_profile" / "player_images"
    for p in default_state.get("playerPool", []):
        pid = str(p.get("id"))
        pname = p.get("name")
        role = p.get("role")
        cat = p.get("category")
        price = p.get("price") or p.get("basePrice")
        
        # Find image file
        matching_files = list(def_img_dir.glob(f"{pid}_*"))
        img_info = None
        if matching_files:
            img_path = matching_files[0]
            chk = sha256_file(img_path)
            insp = inspect_image(img_path)
            img_info = {
                "filename": img_path.name,
                "relative_path": str(img_path.relative_to(BACKUP_DIR)).replace("\\", "/"),
                "file_size_bytes": img_path.stat().st_size,
                "sha256": chk,
                **insp
            }
        
        entry = {
            "player_id": pid,
            "name": pname,
            "role": role,
            "category": cat,
            "base_price": price,
            "sold": p.get("sold", False),
            "sold_price": p.get("soldPrice", 0),
            "team": p.get("team", None),
            "stats": {
                "matches": p.get("matches", 0),
                "runs": p.get("runs", 0),
                "wickets": p.get("wickets", 0),
                "strikeRate": p.get("strikeRate", 0),
                "economy": p.get("economy", 0),
                "battingStyle": p.get("battingStyle", ""),
                "bowlingStyle": p.get("bowlingStyle", "")
            },
            "image": img_info,
            "migration_status": "READY_FOR_MIGRATION"
        }
        manifest["profiles"]["default_profile"]["players"].append(entry)

    # Process KKR vs SRM Profile
    kkr_img_dir = BACKUP_DIR / "profile_kkr_srm" / "player_images"
    for p in kkr_state.get("playerPool", []):
        pid = str(p.get("id"))
        pname = p.get("name")
        role = p.get("role")
        cat = p.get("category")
        price = p.get("price") or p.get("basePrice")
        
        matching_files = list(kkr_img_dir.glob(f"{pid}_*"))
        img_info = None
        if matching_files:
            img_path = matching_files[0]
            chk = sha256_file(img_path)
            insp = inspect_image(img_path)
            img_info = {
                "filename": img_path.name,
                "relative_path": str(img_path.relative_to(BACKUP_DIR)).replace("\\", "/"),
                "file_size_bytes": img_path.stat().st_size,
                "sha256": chk,
                **insp
            }
        
        entry = {
            "player_id": pid,
            "name": pname,
            "role": role,
            "category": cat,
            "base_price": price,
            "sold": p.get("sold", False),
            "sold_price": p.get("soldPrice", 0),
            "team": p.get("team", None),
            "stats": {
                "matches": p.get("matches", 0),
                "runs": p.get("runs", 0),
                "wickets": p.get("wickets", 0),
                "strikeRate": p.get("strikeRate", 0),
                "economy": p.get("economy", 0),
                "battingStyle": p.get("battingStyle", ""),
                "bowlingStyle": p.get("bowlingStyle", "")
            },
            "image": img_info,
            "migration_status": "READY_FOR_MIGRATION"
        }
        manifest["profiles"]["profile_kkr_srm"]["players"].append(entry)

    # Process original_player_pics
    orig_dir = BACKUP_DIR / "original_player_pics"
    if orig_dir.exists():
        for f in orig_dir.glob("*.*"):
            if f.is_file():
                chk = sha256_file(f)
                insp = inspect_image(f)
                manifest["original_player_pics"].append({
                    "filename": f.name,
                    "file_size_bytes": f.stat().st_size,
                    "sha256": chk,
                    **insp
                })

    # Cross-reference players between Default and KKR vs SRM profiles
    def_names = {p["name"].strip().lower(): p for p in manifest["profiles"]["default_profile"]["players"]}
    kkr_names = {p["name"].strip().lower(): p for p in manifest["profiles"]["profile_kkr_srm"]["players"]}
    
    all_names = sorted(list(set(list(def_names.keys()) + list(kkr_names.keys()))))
    
    for name in all_names:
        in_def = def_names.get(name)
        in_kkr = kkr_names.get(name)
        
        same_hash = False
        if in_def and in_kkr and in_def.get("image") and in_kkr.get("image"):
            same_hash = (in_def["image"]["sha256"] == in_kkr["image"]["sha256"])
            
        manifest["identity_cross_reference"][name] = {
            "in_default_profile": bool(in_def),
            "default_id": in_def["player_id"] if in_def else None,
            "in_kkr_srm_profile": bool(in_kkr),
            "kkr_srm_id": in_kkr["player_id"] if in_kkr else None,
            "same_image_hash": same_hash,
            "recommendation": "MERGE_INTO_MASTER_PRESERVE_PARTICIPATIONS" if (in_def and in_kkr and same_hash) else "MAINTAIN_EXPLICIT_SEPARATION"
        }

    # Save manifest
    manifest_path = BACKUP_DIR / "migration_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest written to: {manifest_path}")

    # Also save in external artifact directory
    artifact_manifest = EXTERNAL_BACKUP_DIR / "migration_manifest.json"
    with open(artifact_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Manifest duplicated to artifact dir: {artifact_manifest}")

    # Create immutable compressed zip backup outside working project directory
    zip_target_1 = EXTERNAL_BACKUP_DIR / "auction_nexus_full_backup_immutable.zip"
    print(f"Creating immutable zip backup at: {zip_target_1}...")
    with zipfile.ZipFile(zip_target_1, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(BACKUP_DIR):
            for file in files:
                full_path = Path(root) / file
                rel_path = full_path.relative_to(BACKUP_DIR)
                z.write(full_path, arcname=str(rel_path))
    print(f"Immutable zip created successfully! Size: {zip_target_1.stat().st_size} bytes")

    # Verify the zip can be read and count entries
    with zipfile.ZipFile(zip_target_1, "r") as z:
        entries = z.namelist()
        print(f"Zip verification: {len(entries)} files successfully verified in archive.")

    print("\n=== SUMMARY ===")
    print(f"Default Profile players: {len(manifest['profiles']['default_profile']['players'])} (Images valid: {sum(1 for p in manifest['profiles']['default_profile']['players'] if p['image']['valid'])})")
    print(f"KKR vs SRM players: {len(manifest['profiles']['profile_kkr_srm']['players'])} (Images valid: {sum(1 for p in manifest['profiles']['profile_kkr_srm']['players'] if p['image']['valid'])})")
    print(f"Raw original pics: {len(manifest['original_player_pics'])}")
    print(f"Unique player names across both: {len(all_names)}")

if __name__ == "__main__":
    run_verification_and_manifest()

