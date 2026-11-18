import * as XLSX from 'xlsx';
import { ItemRecord } from '@/components/ItemsClient';

export const META_IMAGE_URL =
  'https://ik.imagekit.io/o3ycj4srnb/logo_1791220956867_pattabhirama_sweets_logo_MKx85h0zJ.jpeg';

export const META_COMMERCE_COMMENTS = [
  "# Required | A unique content ID for the item. Use the item's SKU if you can. Each content ID must appear only once in your catalog. To run dynamic ads this ID must exactly match the content ID for the same item in your Meta Pixel code. Character limit: 100",
  "# Required | A specific and relevant title for the item. See title specifications: https://www.facebook.com/business/help/2104231189874655 Character limit: 200",
  "# Required | A short and relevant description of the item. Include specific or unique product features like material or color. Use plain text and don't enter text in all capital letters. See description specifications: https://www.facebook.com/business/help/2302017289821154 Character limit: 9999",
  "# Required | The current availability of the item. | Supported values: in stock; out of stock",
  "# Required | The current condition of the item. | Supported values: new; used",
  "# Required | The URL of the specific product page where people can buy the item.",
  "# Required | The URL for the main image of your item. Images must be in a supported format (JPG/GIF/PNG) and at least 500 x 500 pixels.",
  "# Required | The brand name of the item. Character limit: 100.",
  "# Optional | The price of the item. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (.) as the decimal point; don't use a comma.",
  "# Optional | The Google product category for the item. Learn more about product categories: https://www.facebook.com/business/help/526764014610932.",
  "# Optional | The Facebook product category for the item. Learn more about product categories: https://www.facebook.com/business/help/526764014610932.",
  "# Optional | The quantity of this item you have to sell on Facebook and Instagram with checkout. Must be 1 or higher or the item won't be buyable",
  "# Optional | The discounted price of the item if it's on sale. Format the price as a number followed by the 3-letter currency code (ISO 4217 standards). Use a period (.) as the decimal point; don't use a comma. A sale price is required if you want to use an overlay for discounted prices.",
  "# Optional | The time range for your sale period. Includes the date and time/time zone when your sale starts and ends. If this field is blank any items with a sale_price remain on sale until you remove the sale price. Use this format: YYYY-MM-DDT23:59+00:00/YYYY-MM-DDT23:59+00:00. Enter the start date as YYYY-MM-DD. Enter a 'T'. Enter the start time in 24-hour format (00:00 to 23:59) followed by the UTC time zone (-12:00 to +14:00). Enter '/' and then repeat the same format for your end date and time. The example row below uses PST time zone (-08:00).",
  "# Optional | Use this field to create variants of the same item. Enter the same group ID for all variants within a group. Learn more about variants: https://www.facebook.com/business/help/2256580051262113 Character limit: 100.",
  "# Optional | The gender of a person that the item is targeted towards. | Supported values: female; male; unisex",
  "# Optional | The color of the item. Use one or more words to describe the color. Don't use a hex code. Character limit: 200.",
  "# Optional | The size of the item written as a word or abbreviation or number. For example: small; XL; 12. Character limit: 200.",
  "# Optional | The age group that the item is targeted towards. | Supported values: adult; all ages; infant; kids; newborn; teen; toddler",
  "# Optional | The material the item is made from; such as cotton; denim or leather. Character limit: 200.",
  "# Optional | The pattern or graphic print on the item. Character limit: 100.",
  "# Optional | Shipping details for the item. Format as Country:Region:Service:Price. Include the 3-letter ISO 4217 currency code in the price. Enter the price as 0.0 to use the free shipping overlay in your ads. Use a semi-colon ';' or a comma \";\" to separate multiple shipping details for different regions or countries. Only people in the specified region or country will see shipping details for that region or country. You can leave out the region (keep the double '::') if your shipping details are the same for an entire country.",
  "# Optional | The shipping weight of the item. Include the unit of measurement (lb/oz/g/kg).",
  "# Optional | Legal disclaimer text for product offers. This text provides important legal or regulatory information that must be displayed with the product offer. For example: \"Valid while supplies last. Terms and conditions apply.\"",
  "# Optional | URL linking to the full disclaimer text. This provides a link to a page containing the complete disclaimer information for the product offer. For example: \"https://example.com/terms-and-conditions\"",
  "# Optional | The URL for a video of your product. Link should be a videos file on a file hosting website; not a video player. Videos must be in a supported format (.3g2; .3gp; .3gpp; .asf; .avi; .dat; .divx; .dv; .f4v; .flv; .gif; .m2ts; .m4v; .mkv; .mod; .mov; .mp4; .mpe; .mpeg; .mpeg4; .mpg; .mts; .nsv; .ogm; .ogv; .qt; .tod; .ts; .vob or .wmv).",
  "# Optional | The URL for a video of your product. Link should be a videos file on a file hosting website; not a video player. Videos must be in a supported format (.3g2; .3gp; .3gpp; .asf; .avi; .dat; .divx; .dv; .f4v; .flv; .gif; .m2ts; .m4v; .mkv; .mod; .mov; .mp4; .mpe; .mpeg; .mpeg4; .mpg; .mts; .nsv; .ogm; .ogv; .qt; .tod; .ts; .vob or .wmv).",
  "# Optional | No field comment specified",
  "# Optional | No field comment specified",
  "# Optional | No field comment specified",
  "# Optional | No field comment specified",
  "# Optional | No field comment specified",
  "# Optional | No field comment specified",
  "# Optional | The item’s Global Trade Item Number (GTIN). Recommended to help classify the item. May appear on the barcode; packaging or book cover. Only provide GTIN if you’re sure it’s correct. GTIN types include UPC (12 digits); EAN (13 digits); JAN (8 or 13 digits); ISBN (13 digits) or ITF-14 (14 digits)",
  "# Optional | Add labels to products to help filter them into product sets. Max characters: 110 per label; 5000 labels per product",
  "# Optional | Add labels to products to help filter them into product sets. Max characters: 110 per label; 5000 labels per product",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Used to determine where item is available; will replace AvailabilityArea eventually",
  "# Optional | Represents the origin points of a circle which will be used together with AvailabilityCircleRadius to represent an availability area",
  "# Optional | Represents the origin points of a circle which will be used together with AvailabilityCircleRadius to represent an availability area",
  "# Optional | Represents the unit of the distance provided in AvailabilityCircleRadius field either KM or MI",
  "# Optional | Represents the radius in KM that the item is available from the availability_coordinates",
  "# Optional | Describe the fashion style of this item."
];

export const META_COMMERCE_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "link",
  "image_link",
  "brand",
  "price",
  "google_product_category",
  "fb_product_category",
  "quantity_to_sell_on_facebook",
  "sale_price",
  "sale_price_effective_date",
  "item_group_id",
  "gender",
  "color",
  "size",
  "age_group",
  "material",
  "pattern",
  "shipping",
  "shipping_weight",
  "offer_disclaimer",
  "offer_disclaimer_url",
  "video[0].url",
  "video[0].tag[0]",
  "address.city",
  "address.country",
  "address.neighborhoods",
  "address.postal_code",
  "address.region",
  "address.street_address",
  "gtin",
  "product_tags[0]",
  "product_tags[1]",
  "availability_polygon_coordinates[0].latitude",
  "availability_polygon_coordinates[0].longitude",
  "availability_polygon_coordinates[1].latitude",
  "availability_polygon_coordinates[1].longitude",
  "availability_polygon_coordinates[2].latitude",
  "availability_polygon_coordinates[2].longitude",
  "availability_polygon_coordinates[3].latitude",
  "availability_polygon_coordinates[3].longitude",
  "availability_circle_origin.latitude",
  "availability_circle_origin.longitude",
  "availability_circle_radius_unit",
  "availability_circle_radius",
  "style[0]"
];

export function buildMetaCommerceRow(item: ItemRecord): (string | number)[] {
  const itemId = (item.code && item.code.trim()) ? item.code.trim() : item.id;
  const title = (item.name || '').trim().slice(0, 200);
  const description = `${item.name || 'Traditional Sweet'} - Fresh and delicious sweets and savouries from Pattabiram Sweets. Available per ${item.unit || 'unit'}.`;
  const availability = item.status === 'Active' ? 'in stock' : 'out of stock';
  const condition = 'new';
  const link = `https://pattabiramsweets.com/items/${encodeURIComponent(item.code || item.id)}`;
  const imageLink = META_IMAGE_URL;
  const brand = 'Pattabiram Sweets';

  const priceNum = typeof item.price === 'number' && !isNaN(item.price) ? item.price : 0;
  const price = `${priceNum.toFixed(2)} INR`;

  const googleProductCategory = 'Food, Beverages & Tobacco > Food Items';
  const fbProductCategory = 'food & beverages';
  const quantityToSell = item.status === 'Active' ? 100 : 0;
  const salePrice = '';
  const salePriceEffectiveDate = '';
  // item_group_id MUST be left empty so Meta Commerce creates each item as an independent product instead of grouping them as variants
  const itemGroupId = '';
  const gender = '';
  const color = '';
  const size = '';
  const ageGroup = 'all ages';
  const material = '';
  const pattern = '';
  const shipping = '';
  const shippingWeight = item.unit === 'KG' ? '1 kg' : '';
  const offerDisclaimer = '';
  const offerDisclaimerUrl = '';
  const videoUrl = '';
  const videoTag = '';
  const addressCity = 'Chennai';
  const addressCountry = 'India';
  const addressNeighborhoods = '';
  const addressPostalCode = '600072';
  const addressRegion = 'Tamil Nadu';
  const addressStreetAddress = '';
  const gtin = '';
  const productTag0 = item.category || 'Sweets';
  const productTag1 = item.unit || '';

  return [
    itemId,
    title,
    description,
    availability,
    condition,
    link,
    imageLink,
    brand,
    price,
    googleProductCategory,
    fbProductCategory,
    quantityToSell,
    salePrice,
    salePriceEffectiveDate,
    itemGroupId,
    gender,
    color,
    size,
    ageGroup,
    material,
    pattern,
    shipping,
    shippingWeight,
    offerDisclaimer,
    offerDisclaimerUrl,
    videoUrl,
    videoTag,
    addressCity,
    addressCountry,
    addressNeighborhoods,
    addressPostalCode,
    addressRegion,
    addressStreetAddress,
    gtin,
    productTag0,
    productTag1,
    '', // availability_polygon_coordinates[0].latitude
    '', // availability_polygon_coordinates[0].longitude
    '', // availability_polygon_coordinates[1].latitude
    '', // availability_polygon_coordinates[1].longitude
    '', // availability_polygon_coordinates[2].latitude
    '', // availability_polygon_coordinates[2].longitude
    '', // availability_polygon_coordinates[3].latitude
    '', // availability_polygon_coordinates[3].longitude
    '', // availability_circle_origin.latitude
    '', // availability_circle_origin.longitude
    '', // availability_circle_radius_unit
    '', // availability_circle_radius
    '', // style[0]
  ];
}

export function exportMetaCommerceExcel(items: ItemRecord[], fileName?: string): number {
  if (!items || items.length === 0) {
    throw new Error('No items available to export.');
  }

  const rows = items.map((item) => buildMetaCommerceRow(item));

  const aoa: (string | number)[][] = [
    META_COMMERCE_COMMENTS,
    META_COMMERCE_HEADERS,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths for readability in Excel
  ws['!cols'] = META_COMMERCE_HEADERS.map((h, i) => {
    if (i === 0) return { wch: 15 }; // id
    if (i === 1) return { wch: 30 }; // title
    if (i === 2) return { wch: 45 }; // description
    if (i === 3) return { wch: 14 }; // availability
    if (i === 4) return { wch: 10 }; // condition
    if (i === 5) return { wch: 40 }; // link
    if (i === 6) return { wch: 50 }; // image_link
    if (i === 7) return { wch: 20 }; // brand
    if (i === 8) return { wch: 15 }; // price
    if (i === 9) return { wch: 35 }; // google_product_category
    if (i === 10) return { wch: 25 }; // fb_product_category
    return { wch: 15 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'facebook_catalog');

  const todayStr = new Date().toISOString().slice(0, 10);
  const outFileName = fileName || `meta_commerce_catalog_${todayStr}.xlsx`;

  XLSX.writeFile(wb, outFileName);

  return items.length;
}

