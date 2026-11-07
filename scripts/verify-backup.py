import os
import json
from PIL import Image

backup_base = os.path.abspath('auction_nexus_full_backup')

def verify_folder(label, folder_path, inv_path):
    print(f'\n--- Verifying {label} ---')
    with open(inv_path, 'r', encoding='utf-8') as f:
        inv = json.load(f)
    print(f'Total records in inventory: {len(inv)}')
    valid_count = 0
    for item in inv:
        fname = item.get('filename')
        if not fname:
            continue
        p = os.path.join(folder_path, fname)
        if not os.path.exists(p):
            print(f"FAILED: Missing file {p}")
            continue
        size = os.path.getsize(p)
        try:
            with Image.open(p) as img:
                img.verify()
            with Image.open(p) as img:
                w, h = img.size
                fmt = img.format
            valid_count += 1
            print(f"  [OK] {item.get('name', fname)} ({fmt} {w}x{h}, {size:,} bytes) -> {fname}")
        except Exception as e:
            print(f"FAILED: {fname} is corrupted: {e}")
    print(f'Result: {valid_count}/{len(inv)} verified successfully.')
    return valid_count == len(inv)

ok1 = verify_folder('Profile 5 (KKR vs SRM)', os.path.join(backup_base, 'profile_kkr_srm', 'player_images'), os.path.join(backup_base, 'profile_kkr_srm', 'inventory.json'))
ok2 = verify_folder('Default Profile (Fresh Pool)', os.path.join(backup_base, 'default_profile', 'player_images'), os.path.join(backup_base, 'default_profile', 'inventory.json'))
ok3 = verify_folder('Original Source Photos', os.path.join(backup_base, 'original_player_pics'), os.path.join(backup_base, 'original_player_pics_inventory.json'))

print('\n=============================================')
if ok1 and ok2 and ok3:
    print('ALL VERIFICATION CHECKS PASSED WITH 100% INTEGRITY!')
else:
    print('VERIFICATION FOUND ISSUES!')
print('=============================================')

