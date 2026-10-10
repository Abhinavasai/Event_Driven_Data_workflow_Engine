/** Stable ids for seeded workflows. */
export const SAMPLE_ORDER_WORKFLOW_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const SAMPLE_PRODUCT_WORKFLOW_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

/** Demo CSV for order uploads. */
export const SAMPLE_ORDER_CSV = `order_id,customer_name,amount,order_date,status
ORD-001,  john doe ,125.50,2026-07-01,pending
ORD-002,jane smith,89.00,2026-07-02,completed
ORD-001,John Doe,125.50,2026-07-01,pending
ORD-003,ACME Corp,450.00,2026-07-03,shipped
ORD-004,alice jones,12.00,2026-07-04,pending
ORD-005,Bob Lee,999.99,2026-07-05,completed
`;

/** Demo JSON for product catalog uploads. */
export const SAMPLE_PRODUCTS_JSON = `[
  {"product_id":"P-100","name":"Widget A","category":"hardware","price":19.99,"in_stock":true},
  {"product_id":"P-101","name":"Widget B","category":"hardware","price":29.5,"in_stock":true},
  {"product_id":"P-102","name":"Gadget X","category":"electronics","price":149.0,"in_stock":false},
  {"product_id":"P-100","name":"Widget A","category":"hardware","price":19.99,"in_stock":true},
  {"product_id":"P-103","name":"Cable Pack","category":"accessories","price":9.25,"in_stock":true}
]`;

/** Intentionally bad CSV for validation / failure demos. */
export const SAMPLE_MALFORMED_CSV = `order_id,customer_name,amount,order_date
ORD-BAD,no status,not-a-number,not-a-date
,missing id,10,2026-07-01
`;
