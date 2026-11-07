import json

with open('auction_nexus_full_backup/migration_manifest.json', 'r', encoding='utf-8') as f:
    m = json.load(f)

print(f"{'PLAYER NAME':15} | {'DEFAULT POOL':18} | {'KKR/SRM POOL':18} | {'SAME IMAGE HASH?'}")
print("-" * 75)
for name, data in m['identity_cross_reference'].items():
    def_info = f"Yes ({data['default_id']})" if data['in_default_profile'] else "No"
    kkr_info = f"Yes ({data['kkr_srm_id']})" if data['in_kkr_srm_profile'] else "No"
    same = "YES (Identical photo)" if data['same_image_hash'] else ("NO / N/A" if (data['in_default_profile'] and data['in_kkr_srm_profile']) else "-")
    print(f"{name:15} | {def_info:18} | {kkr_info:18} | {same}")

