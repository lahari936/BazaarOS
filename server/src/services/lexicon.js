// Spoken forms for intent words and common products in Telugu, Hindi and English (incl. code-mixed).
// Matching is substring-based on a lowercased transcript, so stems cover inflections
// (e.g. "టమాట" matches టమాటాలు / టమాటాలను).

export const WORDS = {
  purchase: ['కొన్నా', 'కొన్నాం', 'కొనుగోలు', 'తెచ్చాను', 'తెప్పించాను', 'కొనేశాను', 'खरीद', 'ख़रीद', 'मंगवा', 'bought', 'purchase', 'buy ', 'kharid', 'konnanu'],
  sale: ['అమ్మా', 'అమ్మేశా', 'అమ్మకం', 'అమ్మేసా', 'విక్రయ', 'बेच', 'बिक', 'बिका', 'sold', 'sell', 'sale ', 'becha', 'ammanu'],
  credit: ['అప్పు', 'ఉద్దెర', 'ఉద్ధెర', 'ఉద్దర', 'ఉదారి', 'బాకీ', 'ఖాతాలో', 'उधार', 'उधारी', 'कर्ज', 'क़र्ज़', 'खाते में', 'credit', 'udhar', 'udhaar', 'appu', 'khata'],
  // customer paying the vendor back
  repay: ['తిరిగి ఇచ్చ', 'చెల్లించ', 'కట్టాడు', 'కట్టింది', 'కట్టారు', 'జమ', 'ఇచ్చాడు', 'ఇచ్చింది', 'ఇచ్చారు', 'ఇచ్చేశాడు', 'ఇచ్చేసింది', 'चुका', 'लौटा', 'वापस', 'जमा', 'ने दिए', 'ने दिया', 'ने दी', 'paid back', 'repaid', 'returned', 'cleared', ' paid', 'gave me', 'payment'],
  // first-person borrowing: money the vendor owes (not supported as a receivable)
  vendorOwes: ['నేను అప్పు తీసుకున్నా', 'అప్పు తీసుకున్నాను', 'నేను ఇవ్వాలి', 'నాకు అప్పు', 'मैंने उधार लिया', 'मैंने कर्ज', 'मुझे देना है', 'मुझे चुकाना', 'i borrowed', 'i owe', 'i have to pay', 'i need to pay'],
  expense: ['ఖర్చు', 'అద్దె', 'కరెంట్', 'కరెంటు', 'రవాణా', 'ఆటో', 'జీతం', 'కూలీ', 'కూలి', 'బిల్లు', 'పెట్రోల్', 'డీజిల్', 'खर्च', 'किराया', 'किराए', 'बिजली', 'भाड़ा', 'भाड़े', 'ऑटो', 'तनख्वाह', 'मजदूरी', 'पेट्रोल', 'बिल', 'expense', 'spent', 'rent', 'electricity', 'transport', 'salary', 'wages', 'petrol', 'diesel', 'bill', 'kharcha'],
  question: ['ఎంత', 'ఎన్ని', 'ఏంటి', 'ఏమిటి', 'చెప్పు', 'చూపించు', 'कितन', 'क्या', 'बताओ', 'बताइए', 'दिखाओ', 'how much', 'how many', 'what', 'show', 'tell', '?'],
  profit: ['లాభం', 'లాభాలు', 'నష్టం', 'लाभ', 'मुनाफ', 'फायदा', 'फ़ायदा', 'नुकसान', 'profit', 'loss', 'labham'],
  stock: ['స్టాక్', 'మిగిలి', 'ఉన్నాయి', 'ఉంది', 'సరుకు', 'stock', 'inventory', 'left', 'available', 'स्टॉक', 'बचा', 'बचे', 'बची', 'माल'],
  report: ['రిపోర్ట్', 'నివేదిక', 'లెక్క', 'అమ్మకాలు', 'వ్యాపారం', 'रिपोर्ट', 'हिसाब', 'बिक्री', 'कमाई', 'report', 'summary', 'sales', 'business', 'collection'],
  upi: ['upi', 'phonepe', 'phone pe', 'gpay', 'google pay', 'paytm', 'ఫోన్ పే', 'యూపీఐ', 'గూగుల్ పే', 'यूपीआई', 'फोन पे', 'ऑनलाइन', 'online'],
  card: ['card', 'కార్డు', 'कार्ड'],
  yesterday: ['నిన్న', 'कल', 'yesterday'],
  week: ['వారం', 'హఫ్తా', 'हफ्त', 'सप्ताह', 'week'],
  month: ['నెల', 'महीन', 'month'],
};

export const UNIT_WORDS = {
  kg: ['కిలో', 'కేజీ', 'కేజి', 'kg', 'kgs', 'kilo', 'किलो', 'केजी'],
  g: ['గ్రాము', 'గ్రాం', 'grams', 'gram', 'gm', 'ग्राम'],
  dozen: ['డజను', 'డజన్', 'dozen', 'दर्जन'],
  piece: ['ముక్క', 'కాయలు', 'pieces', 'piece', 'pcs', 'पीस', 'नग'],
  litre: ['లీటర్', 'లీటరు', 'litre', 'liter', 'ltr', 'लीटर'],
  bunch: ['కట్టలు', 'కట్టల', 'bunch', 'गड्डी', 'गुच्छ'], // not bare "కట్ట": would match కట్టాడు (paid)
  packet: ['ప్యాకెట్', 'packet', 'pack', 'पैकेट'],
};

export const CURRENCY_WORDS = ['రూపాయ', 'రూ.', 'రూ ', 'rupee', 'rupaye', 'rupay', 'rs', 'inr', 'रुपय', 'रुपए', 'रुपये', 'रुपया', 'रु', 'bucks'];
export const PER_WORDS = ['చొప్పున', 'ప్రతి', 'ఒక్కొక్క', 'per', 'each', 'प्रति', 'के भाव', 'के हिसाब'];
export const HALF_WORDS = ['అర', 'आधा', 'half'];

export const EXPENSE_CATEGORIES = [
  ['Rent', ['అద్దె', 'किराया', 'किराए', 'rent']],
  ['Electricity', ['కరెంట్', 'కరెంటు', 'बिजली', 'electricity', 'current bill']],
  ['Transport', ['రవాణా', 'ఆటో', 'పెట్రోల్', 'డీజిల్', 'भाड़ा', 'भाड़े', 'ऑटो', 'पेट्रोल', 'transport', 'auto', 'petrol', 'diesel']],
  ['Wages', ['జీతం', 'కూలీ', 'కూలి', 'तनख्वाह', 'मजदूरी', 'salary', 'wages', 'labour']],
];

// Common products. `forms` are spoken stems in all three languages.
export const PRODUCT_LEXICON = [
  { name: 'Tomatoes', nameLocal: 'టమాటాలు', unit: 'kg', category: 'Vegetables', forms: ['tomato', 'టమాట', 'టమోట', 'టొమాట', 'టమేట', 'टमाटर'] },
  { name: 'Potatoes', nameLocal: 'బంగాళదుంపలు', unit: 'kg', category: 'Vegetables', forms: ['potato', 'aloo', 'బంగాళ', 'ఆలుగడ్డ', 'ఆలూ', 'आलू'] },
  { name: 'Onions', nameLocal: 'ఉల్లిపాయలు', unit: 'kg', category: 'Vegetables', forms: ['onion', 'ఉల్లి', 'ఉల్లిగడ్డ', 'प्याज', 'प्याज़', 'kanda'] },
  { name: 'Green Chillies', nameLocal: 'పచ్చిమిర్చి', unit: 'kg', category: 'Vegetables', forms: ['chilli', 'chili', 'mirchi', 'మిర్చి', 'మిరప', 'మిరపకాయ', 'मिर्च'] },
  { name: 'Carrots', nameLocal: 'క్యారెట్లు', unit: 'kg', category: 'Vegetables', forms: ['carrot', 'క్యారెట్', 'కేరట్', 'गाजर'] },
  { name: 'Brinjal', nameLocal: 'వంకాయలు', unit: 'kg', category: 'Vegetables', forms: ['brinjal', 'eggplant', 'వంకాయ', 'బైంగన్', 'बैंगन'] },
  { name: 'Cabbage', nameLocal: 'క్యాబేజీ', unit: 'kg', category: 'Vegetables', forms: ['cabbage', 'క్యాబేజ', 'పత్తాగోబి', 'पत्तागोभी', 'पत्ता गोभी'] },
  { name: 'Cauliflower', nameLocal: 'కాలీఫ్లవర్', unit: 'piece', category: 'Vegetables', forms: ['cauliflower', 'కాలీఫ్లవర్', 'క్యాలీఫ్లవర్', 'फूलगोभी', 'फूल गोभी'] },
  { name: 'Okra', nameLocal: 'బెండకాయలు', unit: 'kg', category: 'Vegetables', forms: ['okra', 'ladyfinger', 'bhindi', 'బెండ', 'भिंडी'] },
  { name: 'Beans', nameLocal: 'బీన్స్', unit: 'kg', category: 'Vegetables', forms: ['beans', 'బీన్స్', 'बीन्स'] },
  { name: 'Coriander', nameLocal: 'కొత్తిమీర', unit: 'bunch', category: 'Vegetables', forms: ['coriander', 'కొత్తిమీర', 'धनिया'] },
  { name: 'Bananas', nameLocal: 'అరటిపండ్లు', unit: 'dozen', category: 'Fruits', forms: ['banana', 'అరటి', 'केला', 'केले'] },
  { name: 'Apples', nameLocal: 'యాపిల్స్', unit: 'kg', category: 'Fruits', forms: ['apple', 'యాపిల్', 'ఆపిల్', 'सेब'] },
  { name: 'Mangoes', nameLocal: 'మామిడిపండ్లు', unit: 'kg', category: 'Fruits', forms: ['mango', 'మామిడి', 'आम'] },
  { name: 'Lemons', nameLocal: 'నిమ్మకాయలు', unit: 'piece', category: 'Vegetables', forms: ['lemon', 'నిమ్మ', 'नींबू', 'निंबू'] },
  { name: 'Rice', nameLocal: 'బియ్యం', unit: 'kg', category: 'Groceries', forms: ['rice', 'బియ్యం', 'चावल'] },
  { name: 'Sugar', nameLocal: 'చక్కెర', unit: 'kg', category: 'Groceries', forms: ['sugar', 'చక్కెర', 'పంచదార', 'चीनी', 'शक्कर'] },
  { name: 'Milk', nameLocal: 'పాలు', unit: 'litre', category: 'Dairy', forms: ['milk', 'పాలు', 'दूध'] },
  { name: 'Eggs', nameLocal: 'గుడ్లు', unit: 'dozen', category: 'Groceries', forms: ['egg', 'గుడ్లు', 'గుడ్డు', 'अंडे', 'अंडा'] },
];

export const STOPWORDS = new Set(['ఈరోజు', 'ఇవాళ', 'నిన్న', 'నేను', 'మా', 'ఆజ్', 'आज', 'कल', 'मैंने', 'मैं', 'today', 'yesterday', 'i', 'my', 'customer', 'కస్టమర్', 'ग्राहक', 'mr', 'mrs', 'sri', 'shri', 'శ్రీ', 'श्री']);
