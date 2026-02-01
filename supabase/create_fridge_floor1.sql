-- FRIDGE_LT_F1 (냉장고 왼쪽 위 1층) 생성

INSERT INTO storage_locations (store_id, location_type, location_code, location_name, grid_rows, grid_cols, has_floors, parent_location_id)
VALUES 
  ((SELECT id FROM stores WHERE store_code = 'MARKET001'), 
   'FRIDGE_FLOOR', 
   'FRIDGE_LT_F1', 
   '냉장고 왼쪽 위 1층', 
   3, 
   2, 
   false,
   (SELECT id FROM storage_locations WHERE location_code = 'FRIDGE_LT' AND store_id = (SELECT id FROM stores WHERE store_code = 'MARKET001')))
ON CONFLICT DO NOTHING;

SELECT 'FRIDGE_LT_F1 created successfully!' as message;
