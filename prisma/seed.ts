import { PrismaClient, type RoleCode, type SellerType, type OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

const roles: Array<{ code: RoleCode; name: string }> = [
  { code: 'CUSTOMER', name: 'Customer' },
  { code: 'APARTMENT_SELLER', name: 'Apartment Seller' },
  { code: 'OUTSIDE_SELLER', name: 'Outside Seller' },
  { code: 'DELIVERY_BOY', name: 'Delivery Boy' },
  { code: 'GLOBAL_ADMIN', name: 'Global Admin' },
];

async function roleId(code: RoleCode) {
  return (await prisma.role.findUniqueOrThrow({ where: { code } })).id;
}

async function user(phone: string, name: string, roleCodes: RoleCode[]) {
  const record = await prisma.user.upsert({ where: { phone }, update: { name }, create: { phone, name } });
  for (const code of roleCodes) {
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: record.id, roleId: await roleId(code) } }, update: {}, create: { userId: record.id, roleId: await roleId(code) } });
  }
  return record;
}

async function apartment(name: string, hasBlocks: boolean, hasPredefinedFlats: boolean) {
  const existing = await prisma.apartment.findFirst({ where: { name } });
  return existing ?? prisma.apartment.create({ data: { name, city: 'Hyderabad', state: 'Telangana', pincode: '500081', hasBlocks, hasPredefinedFlats } });
}

async function block(apartmentId: string, name: string) {
  return prisma.block.upsert({ where: { apartmentId_name: { apartmentId, name } }, update: { isActive: true }, create: { apartmentId, name } });
}

async function flat(apartmentId: string, blockId: string | null, number: string) {
  const existing = await prisma.flat.findFirst({ where: { apartmentId, blockId, number } });
  return existing ?? prisma.flat.create({ data: { apartmentId, blockId, number } });
}

async function seller(userId: string, sellerType: SellerType, sellerName: string, businessName: string, apartmentId?: string) {
  return prisma.sellerProfile.upsert({
    where: { userId },
    update: { sellerType, sellerName, businessName, status: 'APPROVED', apartmentId, isOpen: true },
    create: { userId, sellerType, sellerName, businessName, status: 'APPROVED', apartmentId, isOpen: true, deliveryEnabled: true, pickupEnabled: true },
  });
}

async function product(sellerId: string, categoryId: string, name: string, sku: string, price: number, inventoryTracking: boolean, quantity: number) {
  const existing = await prisma.product.findFirst({ where: { sellerId, sku } });
  const record = existing ?? await prisma.product.create({ data: { sellerId, categoryId, name, sku, price, discount: 0, finalPrice: price, unit: 'piece', inventoryTracking, availability: true } });
  await prisma.inventory.upsert({ where: { productId: record.id }, update: { quantity }, create: { productId: record.id, quantity, lowStockLevel: 5 } });
  return record;
}

async function category(sellerId: string, name: string) {
  return prisma.sellerCategory.upsert({ where: { sellerId_name: { sellerId, name } }, update: { isActive: true }, create: { sellerId, name, isActive: true } });
}

async function main() {
  for (const item of roles) await prisma.role.upsert({ where: { code: item.code }, update: { name: item.name }, create: item });

  const abc = await apartment('ABC Residency', true, true);
  const myHome = await apartment('My Home Residency', false, true);
  const green = await apartment('Green Valley Apartments', false, false);
  const sunrise = await apartment('Sunrise Towers', true, true);
  const blockA = await block(abc.id, 'Block A');
  const blockB = await block(abc.id, 'Block B');
  await block(sunrise.id, 'Tower 1');
  const abcA101 = await flat(abc.id, blockA.id, 'A101');
  await flat(abc.id, blockA.id, 'A102');
  const abcB502 = await flat(abc.id, blockB.id, 'B502');
  await flat(myHome.id, null, '101');

  const adminOne = await user('9000000001', 'Platform Admin', ['GLOBAL_ADMIN']);
  const adminTwo = await user('9000000002', 'Operations Admin', ['GLOBAL_ADMIN']);
  const customer = await user('9000000010', 'Riya Sharma', ['CUSTOMER']);
  const apartmentSellerUser = await user('9000000020', 'Home Foods Owner', ['CUSTOMER', 'APARTMENT_SELLER']);
  const outsideSellerUser = await user('9000000030', 'Fresh Basket Owner', ['CUSTOMER', 'OUTSIDE_SELLER']);
  const deliveryUser = await user('9000000040', 'Ramesh Kumar', ['DELIVERY_BOY']);
  const bakeryUser = await user('9000000050', 'Sweet Home Bakery Owner', ['CUSTOMER', 'APARTMENT_SELLER']);
  const fashionUser = await user('9000000060', 'Fashion Corner Owner', ['CUSTOMER', 'APARTMENT_SELLER']);
  const supermarketUser = await user('9000000070', 'Sri Lakshmi Supermarket Owner', ['CUSTOMER', 'OUTSIDE_SELLER']);
  const vegetablesUser = await user('9000000080', 'Fresh Vegetables Owner', ['CUSTOMER', 'OUTSIDE_SELLER']);

  await prisma.userApartment.upsert({ where: { userId_apartmentId: { userId: customer.id, apartmentId: abc.id } }, update: { blockId: blockB.id, flatId: abcB502.id, isPrimary: true }, create: { userId: customer.id, apartmentId: abc.id, blockId: blockB.id, flatId: abcB502.id, isPrimary: true } });
  await prisma.userApartment.upsert({ where: { userId_apartmentId: { userId: apartmentSellerUser.id, apartmentId: abc.id } }, update: { blockId: blockA.id, flatId: abcA101.id, isPrimary: true }, create: { userId: apartmentSellerUser.id, apartmentId: abc.id, blockId: blockA.id, flatId: abcA101.id, isPrimary: true } });

  const homeFoods = await seller(apartmentSellerUser.id, 'APARTMENT', 'Home Foods', 'Home Foods', abc.id);
  const freshBasket = await seller(outsideSellerUser.id, 'OUTSIDE', 'Fresh Basket', 'Fresh Basket');
  const sweetHomeBakery = await seller(bakeryUser.id, 'APARTMENT', 'Sweet Home Bakery', 'Sweet Home Bakery', abc.id);
  const fashionCorner = await seller(fashionUser.id, 'APARTMENT', 'Fashion Corner', 'Fashion Corner', sunrise.id);
  const sriLakshmi = await seller(supermarketUser.id, 'OUTSIDE', 'Sri Lakshmi Supermarket', 'Sri Lakshmi Supermarket');
  const freshVegetables = await seller(vegetablesUser.id, 'OUTSIDE', 'Fresh Vegetables', 'Fresh Vegetables');
  for (const apartmentRecord of [abc, myHome, green, sunrise]) {
    await prisma.sellerDeliveryArea.upsert({ where: { sellerId_apartmentId: { sellerId: freshBasket.id, apartmentId: apartmentRecord.id } }, update: { isApproved: true }, create: { sellerId: freshBasket.id, apartmentId: apartmentRecord.id, isApproved: true } });
  }
  for (const apartmentRecord of [abc, myHome, sunrise]) await prisma.sellerDeliveryArea.upsert({ where: { sellerId_apartmentId: { sellerId: sriLakshmi.id, apartmentId: apartmentRecord.id } }, update: { isApproved: true }, create: { sellerId: sriLakshmi.id, apartmentId: apartmentRecord.id, isApproved: true } });
  for (const apartmentRecord of [abc, green]) await prisma.sellerDeliveryArea.upsert({ where: { sellerId_apartmentId: { sellerId: freshVegetables.id, apartmentId: apartmentRecord.id } }, update: { isApproved: true }, create: { sellerId: freshVegetables.id, apartmentId: apartmentRecord.id, isApproved: true } });
  const deliveryBoy = await prisma.deliveryBoy.upsert({ where: { userId: deliveryUser.id }, update: { isActive: true }, create: { userId: deliveryUser.id } });
  await prisma.deliveryBoySeller.upsert({ where: { deliveryBoyId_sellerId: { deliveryBoyId: deliveryBoy.id, sellerId: homeFoods.id } }, update: {}, create: { deliveryBoyId: deliveryBoy.id, sellerId: homeFoods.id } });
  await prisma.deliveryBoySeller.upsert({ where: { deliveryBoyId_sellerId: { deliveryBoyId: deliveryBoy.id, sellerId: freshBasket.id } }, update: {}, create: { deliveryBoyId: deliveryBoy.id, sellerId: freshBasket.id } });
  for (const sellerRecord of [sweetHomeBakery, fashionCorner, sriLakshmi, freshVegetables]) await prisma.deliveryBoySeller.upsert({ where: { deliveryBoyId_sellerId: { deliveryBoyId: deliveryBoy.id, sellerId: sellerRecord.id } }, update: {}, create: { deliveryBoyId: deliveryBoy.id, sellerId: sellerRecord.id } });
  await prisma.deliveryBoyApartment.upsert({ where: { deliveryBoyId_apartmentId: { deliveryBoyId: deliveryBoy.id, apartmentId: abc.id } }, update: {}, create: { deliveryBoyId: deliveryBoy.id, apartmentId: abc.id } });

  const foodCategory = await category(homeFoods.id, 'Popular Meals');
  const groceryCategory = await category(freshBasket.id, 'Groceries');
  const biryani = await product(homeFoods.id, foodCategory.id, 'Signature Chicken Biryani', 'HF-BIRYANI', 180, false, 0);
  const curd = await product(homeFoods.id, foodCategory.id, 'Fresh Curd', 'HF-CURD', 60, true, 40);
  const rice = await product(freshBasket.id, groceryCategory.id, 'Premium Rice 5kg', 'FB-RICE-5KG', 420, true, 50);
  const milk = await product(freshBasket.id, groceryCategory.id, 'Fresh Milk 1L', 'FB-MILK-1L', 65, true, 100);

  const homeCategories = await Promise.all(['Bakery', 'Dairy', 'Household', 'Ready to Eat'].map(name => category(homeFoods.id, name)));
  const outsideCategories = await Promise.all(['Fresh Produce', 'Snacks', 'Personal Care', 'Home Essentials'].map(name => category(freshBasket.id, name)));
  const homeCatalog = [
    'Masala Dosa', 'Paneer Butter Masala', 'Veg Biryani', 'Chicken Curry', 'Ghee Rice', 'Idli Breakfast Box',
    'Samosa Box', 'Chapati Pack', 'Tomato Rice', 'Lemon Rice', 'Gulab Jamun', 'Veg Pulao',
    'Coconut Chutney', 'Filter Coffee', 'Chocolate Brownie', 'Fresh Bread', 'Multigrain Loaf', 'Butter Croissant',
    'Greek Yogurt', 'Paneer 250g', 'Fresh Buttermilk', 'Homemade Pickle', 'Kitchen Towels', 'Dishwash Liquid',
  ];
  const outsideCatalog = [
    'Toor Dal 1kg', 'Wheat Flour 5kg', 'Sunflower Oil 1L', 'Turmeric Powder', 'Green Chilli 250g', 'Tomatoes 1kg',
    'Onions 1kg', 'Potatoes 2kg', 'Bananas 1 Dozen', 'Apples 1kg', 'Oranges 1kg', 'Coriander Bunch',
    'Potato Chips', 'Oat Cookies', 'Peanut Butter', 'Shampoo 180ml', 'Bath Soap Pack', 'Toothpaste 150g',
    'Laundry Detergent', 'Floor Cleaner', 'LED Bulb', 'Storage Container', 'Paper Napkins', 'Aluminium Foil',
  ];
  for (const [index, name] of homeCatalog.entries()) await product(homeFoods.id, homeCategories[index % homeCategories.length].id, name, `HF-CATALOG-${String(index + 1).padStart(2, '0')}`, 45 + index * 7, index % 4 !== 0, index % 4 === 0 ? 0 : 20 + index);
  for (const [index, name] of outsideCatalog.entries()) await product(freshBasket.id, outsideCategories[index % outsideCategories.length].id, name, `FB-CATALOG-${String(index + 1).padStart(2, '0')}`, 35 + index * 9, index % 5 !== 0, index % 5 === 0 ? 0 : 30 + index);
  const bakeryCategory = await category(sweetHomeBakery.id, 'Bakery');
  const fashionCategory = await category(fashionCorner.id, 'Fashion');
  const supermarketCategory = await category(sriLakshmi.id, 'Supermarket');
  const vegetablesCategory = await category(freshVegetables.id, 'Fresh Produce');
  for (const [index, name] of ['Brown Bread', 'Cinnamon Roll', 'Butter Cake', 'Garlic Bun'].entries()) await product(sweetHomeBakery.id, bakeryCategory.id, name, `SHB-${index + 1}`, 55 + index * 30, false, 0);
  for (const [index, name] of ['Cotton Kurta', 'Everyday T-Shirt', 'Kids Dress', 'Canvas Tote'].entries()) await product(fashionCorner.id, fashionCategory.id, name, `FC-${index + 1}`, 299 + index * 110, false, 0);
  for (const [index, name] of ['Toor Dal 1kg', 'Sugar 1kg', 'Tea 250g', 'Basmati Rice 5kg'].entries()) await product(sriLakshmi.id, supermarketCategory.id, name, `SLS-${index + 1}`, 80 + index * 70, true, 25 + index * 10);
  for (const [index, name] of ['Spinach Bunch', 'Carrots 500g', 'Capsicum 500g', 'Cucumbers 1kg'].entries()) await product(freshVegetables.id, vegetablesCategory.id, name, `FV-${index + 1}`, 30 + index * 12, true, 20 + index * 5);

  await prisma.platformSetting.upsert({ where: { key: 'home_seller_display_mode' }, update: { value: 'BOTH', updatedById: adminOne.id }, create: { key: 'home_seller_display_mode', value: 'BOTH', description: 'Controls local/outside seller visibility on customer home', updatedById: adminOne.id } });
  for (const key of ['payments_enabled', 'reviews_enabled', 'seller_ads_enabled', 'global_alerts_enabled', 'pickup_enabled', 'inventory_enabled']) {
    await prisma.featureFlag.upsert({ where: { key }, update: { enabled: key !== 'payments_enabled' }, create: { key, enabled: key !== 'payments_enabled' } });
  }

  await prisma.advertisement.upsert({ where: { id: '00000000-0000-4000-8000-000000000001' }, update: { status: 'APPROVED' }, create: { id: '00000000-0000-4000-8000-000000000001', requesterId: adminOne.id, title: 'Freshly made for your community', description: 'Discover sellers near you.', type: 'PROMOTION', status: 'APPROVED', priority: 10, startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 30 * 86400000) } });
  await prisma.advertisement.upsert({ where: { id: '00000000-0000-4000-8000-000000000002' }, update: { status: 'APPROVED' }, create: { id: '00000000-0000-4000-8000-000000000002', requesterId: homeFoods.userId, sellerId: homeFoods.id, title: 'Home Foods weekend special', description: 'Fresh meals from your neighbour.', type: 'SELLER_ADVERTISEMENT', status: 'APPROVED', priority: 5, startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 14 * 86400000), targets: { create: { apartmentId: abc.id } } } });

  const existingOrder = await prisma.order.findUnique({ where: { orderNumber: 'ORD-SEED-1001' } });
  if (!existingOrder) {
    const order = await prisma.order.create({ data: { orderNumber: 'ORD-SEED-1001', customerId: customer.id, sellerId: homeFoods.id, apartmentId: abc.id, blockId: blockB.id, flatId: abcB502.id, subtotal: 240, discount: 0, deliveryCharge: 20, total: 260, paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PENDING', fulfillmentType: 'DELIVERY', status: 'READY_FOR_PICKUP', items: { create: [{ productId: biryani.id, productName: biryani.name, quantity: 1, unitPrice: 180, totalPrice: 180 }, { productId: curd.id, productName: curd.name, quantity: 1, unitPrice: 60, totalPrice: 60 }], }, statusHistory: { create: [{ toStatus: 'PENDING', note: 'Seed order' }, { fromStatus: 'PENDING', toStatus: 'ACCEPTED' }, { fromStatus: 'ACCEPTED', toStatus: 'PREPARING' }, { fromStatus: 'PREPARING', toStatus: 'READY_FOR_PICKUP' }] } } });
    await prisma.orderDeliveryAssignment.create({ data: { orderId: order.id, deliveryBoyId: deliveryBoy.id } });
  }
  const existingDelivered = await prisma.order.findUnique({ where: { orderNumber: 'ORD-SEED-1002' } });
  if (!existingDelivered) {
    await prisma.order.create({ data: { orderNumber: 'ORD-SEED-1002', customerId: customer.id, sellerId: freshBasket.id, apartmentId: abc.id, blockId: blockB.id, flatId: abcB502.id, subtotal: 485, discount: 25, deliveryCharge: 0, total: 460, paymentMethod: 'DUMMY_PAYMENT', paymentStatus: 'PAID', fulfillmentType: 'DELIVERY', status: 'DELIVERED', deliveredAt: new Date(), items: { create: [{ productId: rice.id, productName: rice.name, quantity: 1, unitPrice: 420, totalPrice: 420 }, { productId: milk.id, productName: milk.name, quantity: 1, unitPrice: 65, totalPrice: 65 }] }, statusHistory: { create: [{ toStatus: 'PENDING', note: 'Seed order' }, { fromStatus: 'PENDING', toStatus: 'ACCEPTED' }, { fromStatus: 'ACCEPTED', toStatus: 'PREPARING' }, { fromStatus: 'PREPARING', toStatus: 'READY_FOR_PICKUP' }, { fromStatus: 'READY_FOR_PICKUP', toStatus: 'ASSIGNED_TO_DELIVERY_BOY' }, { fromStatus: 'ASSIGNED_TO_DELIVERY_BOY', toStatus: 'PICKED_UP' }, { fromStatus: 'PICKED_UP', toStatus: 'OUT_FOR_DELIVERY' }, { fromStatus: 'OUT_FOR_DELIVERY', toStatus: 'DELIVERED' }] } } });
  }

  const lifecycleStatuses: OrderStatus[] = ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'ASSIGNED_TO_DELIVERY_BOY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'];
  for (const status of lifecycleStatuses) {
    const orderNumber = `ORD-SEED-${status}`;
    if (await prisma.order.findUnique({ where: { orderNumber } })) continue;
    const lifecycleOrder = await prisma.order.create({ data: { orderNumber, customerId: customer.id, sellerId: homeFoods.id, apartmentId: abc.id, blockId: blockA.id, flatId: abcA101.id, subtotal: 180, discount: 0, deliveryCharge: 20, total: 200, paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PENDING', fulfillmentType: 'DELIVERY', status, deliveredAt: ['DELIVERED', 'COMPLETED'].includes(status) ? new Date() : undefined, cancelledAt: status === 'CANCELLED' ? new Date() : undefined, items: { create: [{ productId: biryani.id, productName: biryani.name, quantity: 1, unitPrice: 180, totalPrice: 180 }] }, statusHistory: { create: [{ toStatus: 'PENDING', note: 'Seed lifecycle order' }, { fromStatus: 'PENDING', toStatus: status }] } } });
    if (status === 'ASSIGNED_TO_DELIVERY_BOY' || status === 'PICKED_UP' || status === 'OUT_FOR_DELIVERY') await prisma.orderDeliveryAssignment.create({ data: { orderId: lifecycleOrder.id, deliveryBoyId: deliveryBoy.id } });
  }

  console.log('Seed complete');
  console.log('Accounts: admins 9000000001/2, customer 9000000010, apartment seller 9000000020, outside seller 9000000030, delivery boy 9000000040');
  console.log('Dummy OTP rule: last five digits of phone number');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
