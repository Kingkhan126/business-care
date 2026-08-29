const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database via seed.js...");

  // Clean existing data
  await prisma.siteSetting.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.ticketMessage.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.refillReminder.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.prescriptionAuditLog.deleteMany({});
  await prisma.prescription.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash("Pharmacy123!", 10);

  // Site Settings for Section Hiding/Toggling
  await prisma.siteSetting.createMany({
    data: [
      { key: "top_announcement", value: "true", label: "Top License Announcement Bar" },
      { key: "hero_banner", value: "true", label: "Homepage Hero Banner Section" },
      { key: "rx_section", value: "true", label: "Prescription Medicines Highlight Section" },
      { key: "refill_callout", value: "true", label: "Refill Reminders Callout Banner" },
    ],
  });

  // Users
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@pharmacy.com",
      passwordHash,
      role: "ADMIN",
      phone: "+1-800-555-0199",
    },
  });

  const pharmacist = await prisma.user.create({
    data: {
      name: "Dr. Sarah Jenkins, PharmD",
      email: "pharmacist@pharmacy.com",
      passwordHash,
      role: "PHARMACIST",
      phone: "+1-800-555-0188",
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "John Doe",
      email: "customer@pharmacy.com",
      passwordHash,
      role: "CUSTOMER",
      phone: "+1-555-0142",
    },
  });

  // Customer Address
  const address = await prisma.address.create({
    data: {
      userId: customer.id,
      fullName: "John Doe",
      phone: "+1-555-0142",
      street: "742 Evergreen Terrace",
      city: "Springfield",
      state: "IL",
      zipCode: "62704",
      country: "USA",
      isDefault: true,
    },
  });

  // Categories
  const catMedicines = await prisma.category.create({
    data: {
      name: "Medicines",
      slug: "medicines",
      description: "Prescription and over-the-counter pharmaceutical drugs",
      image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&q=80",
      isVisible: true,
    },
  });

  const catOtc = await prisma.category.create({
    data: {
      name: "OTC Products",
      slug: "otc-products",
      description: "Over-the-counter health remedies, pain relievers, cold & flu",
      image: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=500&q=80",
      isVisible: true,
    },
  });

  const catRx = await prisma.category.create({
    data: {
      name: "Prescription Medicines",
      slug: "prescription-medicines",
      description: "Requires valid physician prescription verified by a licensed pharmacist",
      image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=500&q=80",
      isVisible: true,
    },
  });

  const catVitamins = await prisma.category.create({
    data: {
      name: "Vitamins & Supplements",
      slug: "vitamins-supplements",
      description: "Multivitamins, minerals, herbal extracts, and immunity boosters",
      image: "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=500&q=80",
      isVisible: true,
    },
  });

  const catPersonal = await prisma.category.create({
    data: {
      name: "Personal Care",
      slug: "personal-care",
      description: "Body wash, soaps, deodorants, and daily essentials",
      image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&q=80",
      isVisible: true,
    },
  });

  const catSkincare = await prisma.category.create({
    data: {
      name: "Skincare",
      slug: "skincare",
      description: "Dermatological cleansers, moisturizers, serums, and sun protection",
      image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=500&q=80",
      isVisible: true,
    },
  });

  const catHair = await prisma.category.create({
    data: {
      name: "Hair Care",
      slug: "hair-care",
      description: "Shampoos, conditioners, anti-dandruff solutions, and scalp treatments",
      image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&q=80",
      isVisible: true,
    },
  });

  const catOral = await prisma.category.create({
    data: {
      name: "Oral Care",
      slug: "oral-care",
      description: "Toothpaste, electric toothbrushes, mouthwash, and dental floss",
      image: "https://images.unsplash.com/photo-1559591937-e58af1009851?w=500&q=80",
      isVisible: true,
    },
  });

  const catHygiene = await prisma.category.create({
    data: {
      name: "Hygiene Products",
      slug: "hygiene-products",
      description: "Hand sanitizers, wipes, antiseptic liquids, and feminine care",
      image: "https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=500&q=80",
      isVisible: true,
    },
  });

  const catBaby = await prisma.category.create({
    data: {
      name: "Baby & Mother Care",
      slug: "baby-mother-care",
      description: "Infant formula, diapers, baby wipes, and maternal supplements",
      image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&q=80",
      isVisible: true,
    },
  });

  const catDevices = await prisma.category.create({
    data: {
      name: "Medical Devices",
      slug: "medical-devices",
      description: "Blood pressure monitors, thermometers, pulse oximeters, blood glucose meters",
      image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=500&q=80",
      isVisible: true,
    },
  });

  const catWellness = await prisma.category.create({
    data: {
      name: "Wellness Products",
      slug: "wellness-products",
      description: "Aromatherapy, massage oils, orthopedic pillows, and fitness recovery",
      image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=500&q=80",
      isVisible: true,
    },
  });

  // Brands
  const brandPfizer = await prisma.brand.create({
    data: { name: "Pfizer", slug: "pfizer", description: "Global pharmaceutical leader", isVisible: true },
  });

  const brandBayer = await prisma.brand.create({
    data: { name: "Bayer", slug: "bayer", description: "Trusted consumer health & OTC remedies", isVisible: true },
  });

  const brandCeraVe = await prisma.brand.create({
    data: { name: "CeraVe", slug: "cerave", description: "Dermatologist-developed skincare", isVisible: true },
  });

  const brandCentrum = await prisma.brand.create({
    data: { name: "Centrum", slug: "centrum", description: "World's #1 multivitamin brand", isVisible: true },
  });

  const brandOmron = await prisma.brand.create({
    data: { name: "Omron Healthcare", slug: "omron", description: "Precision home medical monitoring equipment", isVisible: true },
  });

  // Products
  const prodAmoxicillin = await prisma.product.create({
    data: {
      name: "Amoxicillin 500mg Capsules (21s)",
      slug: "amoxicillin-500mg-capsules",
      description: "Broad-spectrum penicillin antibiotic used to treat bacterial infections. Requires pharmacist prescription verification.",
      sku: "RX-AMOX-500",
      price: 18.99,
      salePrice: 15.49,
      stockQuantity: 120,
      isPrescriptionRequired: true,
      dosageForm: "Capsule",
      activeIngredients: "Amoxicillin Trihydrate 500mg",
      usageInstructions: "Take 1 capsule every 8 hours as directed by physician. Finish complete course.",
      warnings: "Do not use if allergic to penicillins or cephalosporins. May cause stomach upset.",
      imageUrl: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&q=80",
      categoryId: catRx.id,
      brandId: brandPfizer.id,
      ratingAverage: 4.8,
      ratingCount: 42,
      isFeatured: true,
      isVisible: true,
    },
  });

  const prodAtorvastatin = await prisma.product.create({
    data: {
      name: "Lipitor (Atorvastatin) 20mg Tablets (30s)",
      slug: "lipitor-atorvastatin-20mg-tablets",
      description: "Statin medication used to lower cholesterol and reduce cardiovascular disease risk.",
      sku: "RX-LIP-020",
      price: 34.50,
      stockQuantity: 85,
      isPrescriptionRequired: true,
      dosageForm: "Tablet",
      activeIngredients: "Atorvastatin Calcium 20mg",
      usageInstructions: "Take 1 tablet daily in the evening with or without food.",
      warnings: "Avoid grapefruit juice while taking this medication. Regular blood testing required.",
      imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80",
      categoryId: catRx.id,
      brandId: brandPfizer.id,
      ratingAverage: 4.9,
      ratingCount: 56,
      isFeatured: true,
      isVisible: true,
    },
  });

  const prodAspirin = await prisma.product.create({
    data: {
      name: "Bayer Extra Strength Aspirin 500mg (100 Caplets)",
      slug: "bayer-extra-strength-aspirin-500mg",
      description: "Fast relief for headache, minor arthritis pain, muscle ache, and fever.",
      sku: "OTC-BAY-500",
      price: 11.99,
      salePrice: 9.99,
      stockQuantity: 250,
      isPrescriptionRequired: false,
      dosageForm: "Caplet",
      activeIngredients: "Aspirin 500mg (NSAID)",
      usageInstructions: "Take 1 to 2 caplets every 4 to 6 hours with a full glass of water. Max 8 caplets in 24 hours.",
      warnings: "Contains NSAID. Stomach bleeding warning. Keep out of reach of children.",
      imageUrl: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&q=80",
      categoryId: catOtc.id,
      brandId: brandBayer.id,
      ratingAverage: 4.7,
      ratingCount: 128,
      isFeatured: true,
      isVisible: true,
    },
  });

  const prodCentrumMulti = await prisma.product.create({
    data: {
      name: "Centrum Adults Complete Multivitamin (130 Tablets)",
      slug: "centrum-adults-complete-multivitamin",
      description: "Formulated with 23 key essential micronutrients to support energy, immunity, and metabolism.",
      sku: "VIT-CEN-130",
      price: 19.49,
      salePrice: 16.99,
      stockQuantity: 180,
      isPrescriptionRequired: false,
      dosageForm: "Tablet",
      activeIngredients: "Vitamins A, C, D3, E, K, B6, B12, Zinc, Iron, Magnesium",
      usageInstructions: "Take 1 tablet daily with food.",
      warnings: "Accidental overdose of iron-containing products is a leading cause of fatal poisoning in children under 6.",
      imageUrl: "https://images.unsplash.com/photo-1577401239170-897942555fb3?w=600&q=80",
      categoryId: catVitamins.id,
      brandId: brandCentrum.id,
      ratingAverage: 4.9,
      ratingCount: 310,
      isFeatured: true,
      isVisible: true,
    },
  });

  const prodCeraVeCleanser = await prisma.product.create({
    data: {
      name: "CeraVe Hydrating Facial Cleanser 473ml",
      slug: "cerave-hydrating-facial-cleanser-473ml",
      description: "Non-foaming cleanser with 3 essential ceramides and hyaluronic acid for normal to dry skin.",
      sku: "SKIN-CER-473",
      price: 16.99,
      stockQuantity: 95,
      isPrescriptionRequired: false,
      dosageForm: "Lotion Cleanser",
      activeIngredients: "Ceramides 1, 3, 6-II, Hyaluronic Acid, Glycerin",
      usageInstructions: "Wet skin with lukewarm water. Massage cleanser into skin in a gentle circular motion. Rinse.",
      warnings: "For external use only. Avoid direct contact with eyes.",
      imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80",
      categoryId: catSkincare.id,
      brandId: brandCeraVe.id,
      ratingAverage: 4.9,
      ratingCount: 450,
      isFeatured: true,
      isVisible: true,
    },
  });

  const prodOmronBp = await prisma.product.create({
    data: {
      name: "Omron 10 Series Wireless Upper Arm Blood Pressure Monitor",
      slug: "omron-10-series-blood-pressure-monitor",
      description: "Clinically validated digital monitor featuring dual display, Bluetooth sync, and irregular heartbeat detector.",
      sku: "DEV-OMR-10S",
      price: 89.99,
      salePrice: 74.99,
      stockQuantity: 40,
      isPrescriptionRequired: false,
      dosageForm: "Electronic Device",
      activeIngredients: "N/A",
      usageInstructions: "Wrap cuff around upper arm at heart height. Press START button. Sit quietly during measurement.",
      warnings: "Consult a healthcare provider to interpret blood pressure readings.",
      imageUrl: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80",
      categoryId: catDevices.id,
      brandId: brandOmron.id,
      ratingAverage: 4.8,
      ratingCount: 89,
      isFeatured: true,
      isVisible: true,
    },
  });

  // Coupons
  await prisma.coupon.create({
    data: {
      code: "HEALTH10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minOrderAmount: 30,
      isActive: true,
    },
  });

  await prisma.coupon.create({
    data: {
      code: "WELCOME5",
      discountType: "FIXED",
      discountValue: 5,
      minOrderAmount: 20,
      isActive: true,
    },
  });

  // Refill Reminder
  await prisma.refillReminder.create({
    data: {
      userId: customer.id,
      productId: prodAtorvastatin.id,
      frequencyDays: 30,
      nextRefillDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: "Take 1 pill nightly for cholesterol",
      isActive: true,
    },
  });

  // Sample Prescription
  const prescription = await prisma.prescription.create({
    data: {
      userId: customer.id,
      patientName: "John Doe",
      patientAge: 45,
      fileUrl: "/storage/prescriptions/sample-rx-101.pdf",
      fileName: "John_Doe_Prescription_Aug2026.pdf",
      fileMimeType: "application/pdf",
      status: "APPROVED",
      pharmacistNotes: "Verified with Dr. Smith's office. Valid for 3 refills.",
      reviewedById: pharmacist.id,
      reviewedAt: new Date(),
    },
  });

  // Sample Order
  const order = await prisma.order.create({
    data: {
      orderNumber: "ORD-2026-884920",
      userId: customer.id,
      addressId: address.id,
      shippingAddressJson: JSON.stringify(address),
      status: "PROCESSING",
      paymentStatus: "PAID",
      paymentMethod: "CARD",
      subtotal: 51.49,
      discountAmount: 5.0,
      shippingFee: 4.99,
      totalAmount: 51.48,
      prescriptionId: prescription.id,
      deliveryAgentName: "Express Pharmacy Courier",
      estimatedDelivery: "Aug 31, 2026",
      items: {
        create: [
          {
            productId: prodAmoxicillin.id,
            productName: prodAmoxicillin.name,
            unitPrice: 15.49,
            quantity: 1,
            isPrescriptionRequired: true,
            totalPrice: 15.49,
          },
          {
            productId: prodAspirin.id,
            productName: prodAspirin.name,
            unitPrice: 9.99,
            quantity: 2,
            isPrescriptionRequired: false,
            totalPrice: 19.98,
          },
          {
            productId: prodCeraVeCleanser.id,
            productName: prodCeraVeCleanser.name,
            unitPrice: 16.99,
            quantity: 1,
            isPrescriptionRequired: false,
            totalPrice: 16.99,
          },
        ],
      },
    },
  });

  // Sample Review
  await prisma.review.create({
    data: {
      userId: customer.id,
      productId: prodAspirin.id,
      rating: 5,
      comment: "Works fast for headaches. Trusted Bayer quality.",
      isApproved: true,
    },
  });

  // Support Ticket
  await prisma.supportTicket.create({
    data: {
      ticketNumber: "TCK-99201",
      userId: customer.id,
      orderId: order.id,
      subject: "Inquiry about prescription delivery timing",
      category: "Order Delivery",
      status: "IN_PROGRESS",
      priority: "Normal",
      messages: {
        create: [
          {
            senderId: customer.id,
            message: "Hello, when will my prescription order be dispatched?",
          },
          {
            senderId: pharmacist.id,
            message: "Hello John, your prescription was verified and approved by Dr. Jenkins. Your order is currently being packed and will be handed to Express Courier today.",
          },
        ],
      },
    },
  });

  console.log("Seeding complete with site settings & visibility toggles.");
}

main()
  .catch((e) => {
    console.error("Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
