import { db } from './schema.js';
export const OFFICIAL_CATEGORIES = [
    { id: 'cat_snack', name: 'Snack', name_amharic: 'መክሰስ', icon: '🍔', sort_order: 1 },
    { id: 'cat_pizza', name: 'Pizza', name_amharic: 'ፒዛ', icon: '🍕', sort_order: 2 },
    { id: 'cat_juice', name: 'Juice', name_amharic: 'ጭማቂ', icon: '🧃', sort_order: 3 },
    { id: 'cat_hot_drinks', name: 'Hot Drinks', name_amharic: 'ትኩስ መጠጦች', icon: '☕', sort_order: 4 },
    { id: 'cat_salad', name: 'Salad', name_amharic: 'ሰላጣ', icon: '🥗', sort_order: 5 },
    { id: 'cat_fish', name: 'Fish Corner', name_amharic: 'የዓሣ ምግቦች', icon: '🐟', sort_order: 6 },
    { id: 'cat_breakfast', name: 'Breakfast', name_amharic: 'ቁርስ', icon: '🍳', sort_order: 7 },
    { id: 'cat_lunch', name: 'Lunch', name_amharic: 'ምሳ', icon: '🍲', sort_order: 8 },
    { id: 'cat_asian_fusion', name: 'Asian Fusion', name_amharic: 'ኤዥያን ፊውዥን', icon: '🍜', sort_order: 9 },
    { id: 'cat_pasta_rice', name: 'Pasta & Rice', name_amharic: 'ፓስታ እና ሩዝ', icon: '🍝', sort_order: 10 },
    { id: 'cat_cold_drinks', name: 'Cold Drinks', name_amharic: 'ቀዝቃዛ መጠጦች', icon: '🥤', sort_order: 11 }
];
export const OFFICIAL_MENU_ITEMS = [
    // 1. መክሰስ (Snack)
    {
        id: 'snack_yo_special_burger',
        category_id: 'cat_snack',
        name: 'Yo Special Burger',
        name_amharic: 'ዮ ስፔሻል በርገር',
        description: 'Signature toasted brioche burger loaded with juicy prime beef, melted cheese, egg, caramelized onions & house special sauce',
        price: 530,
        photo_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_yo_feshta_burger',
        category_id: 'cat_snack',
        name: 'Yo Feshta Burger',
        name_amharic: 'ዮ ፍሽታ በርገር',
        description: 'Deluxe celebration burger stacked with double prime beef patties, bacon, cheddar, crispy lettuce & secret feshta glaze',
        price: 700,
        photo_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_big_burger',
        category_id: 'cat_snack',
        name: 'Big Burger',
        name_amharic: 'ቢግ በርገር (ትልቅ በርገር)',
        description: 'Giant hunger-crusher burger with thick grilled patty, double cheese, crisp pickles, ripe tomatoes & herb mayo',
        price: 580,
        photo_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_chicken_shawarma',
        category_id: 'cat_snack',
        name: 'Chicken Shewarema',
        name_amharic: 'የዶሮ ሻዋርማ',
        description: 'Tender marinated roasted chicken strips wrapped in warm pita with garlic toum sauce, fresh herbs & pickles',
        price: 580,
        photo_url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_egg_sandwich',
        category_id: 'cat_snack',
        name: 'Egg Sandwich',
        name_amharic: 'የእንቁላል ሳንድዊች',
        description: 'Golden fluffy scrambled eggs with melted cheese, bell peppers & toasted country bread',
        price: 370,
        photo_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_vegetable_sandwich',
        category_id: 'cat_snack',
        name: 'Vegetable Sandwich',
        name_amharic: 'የአትክልት ሳንድዊች',
        description: 'Crisp garden greens, cucumbers, tomatoes, avocado spread and vinaigrette on whole wheat toast',
        price: 350,
        photo_url: 'https://images.unsplash.com/photo-1540713434306-5852581022f0?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_club_sandwich',
        category_id: 'cat_snack',
        name: 'Club Sandwich',
        name_amharic: 'ክለብ ሳንድዊች',
        description: 'Triple-decker toasted sandwich layered with chicken, fried egg, cheese, lettuce, tomato & mayo served with chips',
        price: 530,
        photo_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_tuna_club_sandwich',
        category_id: 'cat_snack',
        name: 'Tuna Club Sandwich',
        name_amharic: 'የቱና ክለብ ሳንድዊች',
        description: 'Rich flaked tuna blended with creamy mayo, celery, sweet relish, sliced boiled eggs & lettuce in a triple layer',
        price: 560,
        photo_url: 'https://images.unsplash.com/photo-1554433607-66b5efe9d304?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'snack_chips',
        category_id: 'cat_snack',
        name: 'Chips',
        name_amharic: 'ቺፕስ (የድንች ጥብስ)',
        description: 'Golden crispy freshly hand-cut potato chips seasoned with sea salt and served with tangy ketchup',
        price: 350,
        photo_url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&q=80',
        prep_time_minutes: 8,
        routing_destination: 'KITCHEN'
    },
    // 2. ፒዛ (Pizza)
    {
        id: 'pizza_special',
        category_id: 'cat_pizza',
        name: 'Special Pizza',
        name_amharic: 'ስፔሻል ፒዛ',
        description: 'Wood-fired crust with spiced beef, chicken, black olives, bell peppers, mozzarella & chef secret herbs',
        price: 700,
        photo_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80',
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pizza_super_special',
        category_id: 'cat_pizza',
        name: 'Super Special Pizza',
        name_amharic: 'ሱፐር ስፔሻል ፒዛ',
        description: 'The supreme meat-lover feast: double mozzarella, beef sausage, chicken breast, mushrooms, onions & extra cheese blend',
        price: 850,
        photo_url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&q=80',
        prep_time_minutes: 22,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pizza_chicken',
        category_id: 'cat_pizza',
        name: 'Chicken Pizza',
        name_amharic: 'የዶሮ ፒዛ',
        description: 'Tender grilled chicken chunks, sweet corn, red onions, BBQ swirl & melted mozzarella cheese',
        price: 720,
        photo_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80',
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pizza_tuna_special',
        category_id: 'cat_pizza',
        name: 'Tuna Special Pizza',
        name_amharic: 'የቱና ስፔሻል ፒዛ',
        description: 'Flaked skipjack tuna, red onions, garlic oil, oregano, black olives & premium mozzarella on golden crust',
        price: 750,
        photo_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pizza_margherita',
        category_id: 'cat_pizza',
        name: 'Margherita Pizza',
        name_amharic: 'ማርጋሪታ ፒዛ',
        description: 'Classic Italian masterpiece with San Marzano tomato sauce, fresh creamy mozzarella and garden basil',
        price: 570,
        photo_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pizza_tuna_fasting',
        category_id: 'cat_pizza',
        name: 'Tuna Fasting Pizza',
        name_amharic: 'የቱና የጾም ፒዛ',
        description: 'Fasting-friendly olive oil crust with flaked tuna, diced tomatoes, bell peppers, onions & tomato herb base',
        price: 580,
        photo_url: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pizza_vegetarian',
        category_id: 'cat_pizza',
        name: 'Vegetarian Pizza',
        name_amharic: 'የአትክልት ፒዛ (የጾም ፒዛ)',
        description: '100% vegetarian fasting pizza with fresh mushrooms, bell peppers, sweet onions, tomatoes & black olives',
        price: 450,
        photo_url: 'https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    // 3. ጭማቂ (Juice)
    {
        id: 'juice_yo_special',
        category_id: 'cat_juice',
        name: 'Yo Special Juice',
        name_amharic: 'ዮ ስፔሻል ጭማቂ',
        description: 'Multi-layered tropical signature smoothie: fresh avocado, sweet mango, papaya & strawberry with lime drizzle',
        price: 220,
        photo_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&q=80',
        prep_time_minutes: 6,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_telebea_shake',
        category_id: 'cat_juice',
        name: 'Telebea Shake',
        name_amharic: 'የተልባ ሼክ (የተልባ ጁስ)',
        description: 'Traditional wholesome Ethiopian flaxseed shake rich in omega-3, toasted nutty aroma and natural honey sweetness',
        price: 160,
        photo_url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_mixed',
        category_id: 'cat_juice',
        name: 'Mixed Juice',
        name_amharic: 'ቅልቅል ጭማቂ (ሚክስድ ጁስ)',
        description: 'Colorful layered fresh fruit juice blend featuring rich avocado, sweet mango and golden papaya puree',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&q=80',
        prep_time_minutes: 6,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_chocolate_shake',
        category_id: 'cat_juice',
        name: 'Chocolate Juice / Shake',
        name_amharic: 'ቸኮሌት ሼክ / ጁስ',
        description: 'Decadent creamy chocolate milkshake blended with cocoa fudge, chilled milk and whipped topping',
        price: 240,
        photo_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_protein_shake',
        category_id: 'cat_juice',
        name: 'Protein Shake',
        name_amharic: 'ፕሮቲን ሼክ',
        description: 'High-energy post-workout shake packed with pure whey protein, banana, peanut butter and oat milk',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1577805947697-89e18249d767?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_avocado',
        category_id: 'cat_juice',
        name: 'Avocado',
        name_amharic: 'አቮካዶ ጭማቂ',
        description: 'Thick, creamy Ethiopian-style fresh avocado smoothie served with natural lime wedge and Vimto drizzle',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_papaya',
        category_id: 'cat_juice',
        name: 'Papaya',
        name_amharic: 'ፓፓያ ጭማቂ',
        description: 'Vibrant sun-ripened tropical papaya smoothie, naturally sweet and smooth with fresh citrus hint',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_pineapple',
        category_id: 'cat_juice',
        name: 'Pineapple',
        name_amharic: 'ፓይናፕል ጭማቂ',
        description: 'Freshly squeezed golden pineapple juice packed with refreshing tropical tang and vitamin C',
        price: 250,
        photo_url: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_oreo_shake',
        category_id: 'cat_juice',
        name: 'Oreo Shake',
        name_amharic: 'ኦሪዮ ሼክ',
        description: 'Creamy vanilla ice cream shake blended with real crunchy Oreo biscuit crumbs and chocolate drizzle',
        price: 320,
        photo_url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&q=80',
        prep_time_minutes: 6,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_strawberry',
        category_id: 'cat_juice',
        name: 'Strobery',
        name_amharic: 'እንጆሪ ጭማቂ (ስትሮበሪ)',
        description: 'Chilled sweet wild strawberry juice bursting with fresh berry flavor and ruby red goodness',
        price: 300,
        photo_url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'juice_ananas',
        category_id: 'cat_juice',
        name: 'Ananas',
        name_amharic: 'አናናስ ጭማቂ',
        description: 'Sweet tropical ananas puree served ice-cold, vibrant and incredibly thirst-quenching',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    // 4. ትኩስ መጠጦች (Hot Drinks)
    {
        id: 'hot_makiyato',
        category_id: 'cat_hot_drinks',
        name: 'Makiyato',
        name_amharic: 'ማኪያቶ',
        description: 'Authentic Ethiopian espresso layered with velvety steamed milk foam in classic clear glass',
        price: 100,
        photo_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&q=80',
        prep_time_minutes: 4,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_coffee',
        category_id: 'cat_hot_drinks',
        name: 'Coffee',
        name_amharic: 'ቡና',
        description: 'Freshly roasted Ethiopian highland single-origin dark roasted espresso coffee',
        price: 80,
        photo_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80',
        prep_time_minutes: 3,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_special_tea',
        category_id: 'cat_hot_drinks',
        name: 'Special Tea',
        name_amharic: 'ስፔሻል ሻይ',
        description: 'Aromatic black tea brewed with fresh cloves, ginger, cinnamon bark, mint leaves & honey',
        price: 150,
        photo_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_cappuccino',
        category_id: 'cat_hot_drinks',
        name: 'Cappuccino',
        name_amharic: 'ካፑቺኖ',
        description: 'Perfect balance of bold espresso, silky steamed milk and a thick layer of frothed microfoam with cocoa dust',
        price: 110,
        photo_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_latte',
        category_id: 'cat_hot_drinks',
        name: 'Latte',
        name_amharic: 'ካፌ ላቴ',
        description: 'Smooth, creamy steamed whole milk poured gently over a single shot of rich dark espresso',
        price: 100,
        photo_url: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=600&q=80',
        prep_time_minutes: 4,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_keshir',
        category_id: 'cat_hot_drinks',
        name: 'Keshir',
        name_amharic: 'ቀሽር (የቡና ቀሽር)',
        description: 'Traditional Ethiopian dried coffee husk tea infused with warm spiced ginger and aromatic spices',
        price: 60,
        photo_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_tea',
        category_id: 'cat_hot_drinks',
        name: 'Tea',
        name_amharic: 'ሻይ',
        description: 'Classic hot brewed black tea served steaming with fresh aroma',
        price: 50,
        photo_url: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600&q=80',
        prep_time_minutes: 3,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_tea_lemon',
        category_id: 'cat_hot_drinks',
        name: 'Tea with Lemon',
        name_amharic: 'ሻይ በሎሚ',
        description: 'Comforting piping hot black tea infused with fresh citrus lemon slice',
        price: 80,
        photo_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80',
        prep_time_minutes: 3,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_nut_tea',
        category_id: 'cat_hot_drinks',
        name: 'Nut Tea',
        name_amharic: 'የለውዝ ሻይ',
        description: 'Nourishing hot spiced tea brewed with crushed roasted peanuts and natural milk',
        price: 100,
        photo_url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_ice_coffee',
        category_id: 'cat_hot_drinks',
        name: 'Ice Coffee',
        name_amharic: 'አይስ ኮፊ (ቀዝቃዛ ቡና)',
        description: 'Refreshing cold-brewed espresso served over crystalline ice cubes with chilled milk and syrup',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&q=80',
        prep_time_minutes: 4,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_chocolate',
        category_id: 'cat_hot_drinks',
        name: 'Hot Chocolate',
        name_amharic: 'ትኩስ ቸኮሌት',
        description: 'Steaming rich Dutch cocoa blended with velvety whole milk and melted dark chocolate drops',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_caramel',
        category_id: 'cat_hot_drinks',
        name: 'Hot Caramel',
        name_amharic: 'ትኩስ ካራሜል',
        description: 'Warm steamed milk laced with buttery golden caramel syrup and a light vanilla crema',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&q=80',
        prep_time_minutes: 5,
        routing_destination: 'BAR'
    },
    {
        id: 'hot_jebena_coffee',
        category_id: 'cat_hot_drinks',
        name: 'Jebena Coffee',
        name_amharic: 'የጀበና ቡና',
        description: 'Traditional authentic Ethiopian clay-pot jebena brewed buna with rich incense aroma and rue herb',
        price: 60,
        photo_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80',
        prep_time_minutes: 6,
        routing_destination: 'BAR'
    },
    // 5. ሰላጣ (Salad)
    {
        id: 'salad_special',
        category_id: 'cat_salad',
        name: 'Special Salad',
        name_amharic: 'ስፔሻል ሰላጣ',
        description: 'Chef signature crispy garden bowl: grilled chicken breast, hard-boiled eggs, avocado, cherry tomatoes, cucumbers & house vinaigrette',
        price: 550,
        photo_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'salad_mixed',
        category_id: 'cat_salad',
        name: 'Mixed Salad',
        name_amharic: 'ቅልቅል ሰላጣ (ሚክስድ ሰላጣ)',
        description: 'Crisp green lettuce, sliced cucumbers, sweet red onions, carrots and ripe tomatoes in light lemon dressing',
        price: 350,
        photo_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
        prep_time_minutes: 8,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'salad_tuna',
        category_id: 'cat_salad',
        name: 'Tuna Salad',
        name_amharic: 'የቱና ሰላጣ',
        description: 'Flaked skipjack tuna chunks over crisp romaine, black olives, sweet corn, boiled eggs and olive oil vinaigrette',
        price: 600,
        photo_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    // 6. የዓሣ ምግቦች (Fish Corner)
    {
        id: 'fish_goulash',
        category_id: 'cat_fish',
        name: 'Fish Goulash',
        name_amharic: 'የዓሣ ጉላሽ',
        description: 'Tender Lake Tana white fish cubes simmered in a rich garlic, tomato, bell pepper & berbere reduction',
        price: 500,
        photo_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'fish_lebleb',
        category_id: 'cat_fish',
        name: 'Fish Lebleb',
        name_amharic: 'የዓሣ ለብለብ',
        description: 'Pan-seared fish fillet lightly spiced with rosemary, green chilies, garlic butter and citrus',
        price: 480,
        photo_url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'fish_cutlet',
        category_id: 'cat_fish',
        name: 'Fish Cutlet',
        name_amharic: 'የዓሣ ኩትሌት',
        description: 'Golden crumb-crusted fish cakes fried to crispy perfection, served with lemon tartar sauce and chips',
        price: 500,
        photo_url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    // 7. ቁርስ (Breakfast)
    {
        id: 'bf_dulet',
        category_id: 'cat_breakfast',
        name: 'Dulet',
        name_amharic: 'ዱለት',
        description: 'Finely minced tripe, lean beef & liver pan-sautéed with spiced butter, onions, mitmita & jalapeños',
        price: 450,
        photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
        prep_time_minutes: 14,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_firfir',
        category_id: 'cat_breakfast',
        name: 'Firfir',
        name_amharic: 'ፍርፍር',
        description: 'Torn fresh injera simmered in aromatic berbere stew infused with spiced niter kibbeh & herbs',
        price: 280,
        photo_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_tibes_firfir',
        category_id: 'cat_breakfast',
        name: 'Tibes Firfir',
        name_amharic: 'የጥብስ ፍርፍር',
        description: 'Classic spicy injera firfir topped with sizzling hot tender beef cubes pan-roasted with rosemary',
        price: 450,
        photo_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_kuanta_firfir',
        category_id: 'cat_breakfast',
        name: 'Kuanta Firfir',
        name_amharic: 'የቋንጣ ፍርፍር',
        description: 'Traditional sun-dried cured beef strips (kuanta) slow cooked in berbere stew and tossed with soft injera',
        price: 480,
        photo_url: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_atekelet_firfir',
        category_id: 'cat_breakfast',
        name: 'Atekelet Firfir',
        name_amharic: 'የአትክልት ፍርፍር',
        description: 'Healthy fasting injera firfir made with fresh tomatoes, sweet peppers, garlic & vegetable oil',
        price: 300,
        photo_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_chechebsa',
        category_id: 'cat_breakfast',
        name: 'Chechebsa',
        name_amharic: 'ጨጨብሳ',
        description: 'Torn pan-fried kitta flatbread tossed warm in rich berbere & spiced butter (niter kibbeh) with pure honey',
        price: 270,
        photo_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_special_chechebsa',
        category_id: 'cat_breakfast',
        name: 'Special Chechebsa',
        name_amharic: 'ስፔሻል ጨጨብሳ',
        description: 'Chechebsa deluxe crowned with farm-fresh fried egg, extra spiced butter, and pure organic honey',
        price: 350,
        photo_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_kinche',
        category_id: 'cat_breakfast',
        name: 'Kinche',
        name_amharic: 'ቂንጬ',
        description: 'Cracked wheat grain porridge cooked tender and tossed with fragrant spiced Ethiopian butter (niter kibbeh)',
        price: 280,
        photo_url: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_omlet',
        category_id: 'cat_breakfast',
        name: 'Omlet',
        name_amharic: 'ኦምሌት',
        description: 'Classic folded golden egg omelette with mild seasoning and toasted bread',
        price: 270,
        photo_url: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=600&q=80',
        prep_time_minutes: 8,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_egg_scrambler',
        category_id: 'cat_breakfast',
        name: 'Egg Scrambler',
        name_amharic: 'የተመታ እንቁላል (ስክራምብልድ ኤግ)',
        description: 'Fluffy pan-scrambled eggs sautéed with onions, green peppers, tomatoes and warm crusty rolls',
        price: 280,
        photo_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80',
        prep_time_minutes: 8,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_special_omlet',
        category_id: 'cat_breakfast',
        name: 'Special Omlet',
        name_amharic: 'ስፔሻል ኦምሌት',
        description: 'Loaded omelette stuffed with cheese, diced peppers, onions, tomatoes and sliced mushrooms',
        price: 400,
        photo_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_egg_with_meat',
        category_id: 'cat_breakfast',
        name: 'Egg with Meat',
        name_amharic: 'እንቁላል በስጋ',
        description: 'Sizzling scrambled eggs combined with seasoned minced beef, caramelized onions and spicy chilies',
        price: 400,
        photo_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_combo',
        category_id: 'cat_breakfast',
        name: 'Combo',
        name_amharic: 'ኮምቦ (የቁርስ ቅልቅል)',
        description: 'Grand Ethiopian breakfast sampler: Chechebsa, Kinche, Tibs Firfir & scrambled eggs served with fresh injera',
        price: 650,
        photo_url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80',
        prep_time_minutes: 16,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_fasting_combo',
        category_id: 'cat_breakfast',
        name: 'Fasting Combo',
        name_amharic: 'የጾም ኮምቦ',
        description: 'Vegan breakfast feast: Veggie Firfir, Chechebsa with oil & honey, and warm Kinche with pure vegetable oil',
        price: 550,
        photo_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
        prep_time_minutes: 14,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_fetira',
        category_id: 'cat_breakfast',
        name: 'Fetira',
        name_amharic: 'ፈጢራ',
        description: 'Crispy flaky puff pastry pan-fried with egg filling and drizzled with warm amber honey',
        price: 370,
        photo_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_yebet_keta',
        category_id: 'cat_breakfast',
        name: 'Yebet Keta',
        name_amharic: 'የቤት ቂጣ',
        description: 'Traditional home-style Ethiopian skillet flatbread baked golden with toasted crust',
        price: 200,
        photo_url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600&q=80',
        prep_time_minutes: 10,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'bf_eggs_avocado',
        category_id: 'cat_breakfast',
        name: 'Eggs with Avocado',
        name_amharic: 'እንቁላል በአቮካዶ',
        description: 'Perfect breakfast platter pairing fluffy scrambled eggs with creamy sliced Hass avocados & toasted bread',
        price: 370,
        photo_url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80',
        prep_time_minutes: 8,
        routing_destination: 'KITCHEN'
    },
    // 8. ምሳ (Lunch)
    {
        id: 'lunch_lamb_tibs',
        category_id: 'cat_lunch',
        name: 'LAMP Tibes (Lamb Tibs)',
        name_amharic: 'የበግ ጥብስ',
        description: 'Tender prime lamb morsels sautéed with niter kibbeh, garlic, sliced red onions & fresh rosemary in sizzling clay pot',
        price: 650,
        photo_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80',
        prep_time_minutes: 16,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_fillet_tibs',
        category_id: 'cat_lunch',
        name: 'Fillet Tibes',
        name_amharic: 'የፊሌ ጥብስ (ለስላሳ ጥብስ)',
        description: 'Melt-in-your-mouth beef tenderloin fillet cuts pan-seared in clarified butter with green peppers & awaze',
        price: 600,
        photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
        prep_time_minutes: 16,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_traditional_combo',
        category_id: 'cat_lunch',
        name: 'Traditional Combo',
        name_amharic: 'የባህል በያይነት',
        description: 'Magnificent banquet platter featuring Doro Wot, Siga Wot, Alicha, Kitfo, Shiro, Gomen and cheese on freshly rolled injera',
        price: 1700,
        photo_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80',
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_half_combo',
        category_id: 'cat_lunch',
        name: 'Half Combo',
        name_amharic: 'ግማሽ በያይነት (ሀፍ ኮምቦ)',
        description: 'Half portion traditional combination feast with a rich assortment of savory meat and vegetable stews',
        price: 1050,
        photo_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_shiro',
        category_id: 'cat_lunch',
        name: 'Shiro',
        name_amharic: 'ሽሮ ወጥ',
        description: 'Classic ground chickpea stew slow-simmered with garlic, onions & authentic berbere, served steaming with injera',
        price: 280,
        photo_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_tegabino',
        category_id: 'cat_lunch',
        name: 'Tegabino',
        name_amharic: 'ተጋቢኖ ሽሮ',
        description: 'Extra thick, bubbling hot Shiro served sizzling in an earthenware pot with niter kibbeh & fresh green chili',
        price: 320,
        photo_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80',
        prep_time_minutes: 14,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_bozena_shiro',
        category_id: 'cat_lunch',
        name: 'Bozena Shiro',
        name_amharic: 'ቦዘና ሽሮ',
        description: 'Rich roasted chickpea shiro stew enriched with tender seasoned minced beef chunks and spiced butter',
        price: 450,
        photo_url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_agelegel',
        category_id: 'cat_lunch',
        name: 'Agelegel',
        name_amharic: 'አገልግል',
        description: 'Royal feast packed in a traditional leather-bound agelgel: Tibs, Doro Wot, boiled eggs, Kuanta & Ayib layered between injera',
        price: 1500,
        photo_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80',
        prep_time_minutes: 22,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_half_agelegel',
        category_id: 'cat_lunch',
        name: 'Half Agelegel',
        name_amharic: 'ግማሽ አገልግል',
        description: 'Personal size traditional Agelgel layered feast for one or two persons with rich savory meats & eggs',
        price: 850,
        photo_url: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_keywet',
        category_id: 'cat_lunch',
        name: 'Keywet',
        name_amharic: 'ቀይ ወጥ',
        description: 'Spicy slow-cooked beef stew in rich berbere gravy, caramelized onions, garlic & aromatic cardamom',
        price: 450,
        photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_gomen_besga',
        category_id: 'cat_lunch',
        name: 'Gomen Besga',
        name_amharic: 'ጎመን በስጋ',
        description: 'Tender collard greens sautéed with flavorful cuts of prime beef, ginger, garlic & spiced butter',
        price: 450,
        photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'lunch_fasting_combo',
        category_id: 'cat_lunch',
        name: 'Fasting Combo',
        name_amharic: 'የጾም በያይነት',
        description: 'Colorful vegan mosaic: Misir Wot, Kik Alicha, Gomen, Atakilt Wot, Shiro & beetroot salad on fresh injera',
        price: 650,
        photo_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80',
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
    },
    // 9. ኤዥያን ፊውዥን (Asian Fusion)
    {
        id: 'asian_special_noodles',
        category_id: 'cat_asian_fusion',
        name: 'Special Noodles',
        name_amharic: 'ስፔሻል ኑድልስ',
        description: 'Wok-tossed egg noodles with beef, chicken, julienne vegetables, sesame oil and savory Asian soy glaze',
        price: 650,
        photo_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',
        prep_time_minutes: 14,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_chicken_noodles',
        category_id: 'cat_asian_fusion',
        name: 'Chicken Noodles',
        name_amharic: 'የዶሮ ኑድልስ',
        description: 'Tender chicken breast slices stir-fried with stir-fry noodles, crunchy cabbage, carrots & sweet garlic sauce',
        price: 630,
        photo_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&q=80',
        prep_time_minutes: 14,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_european_combo',
        category_id: 'cat_asian_fusion',
        name: 'European Combo',
        name_amharic: 'ዩሮፒያን ኮምቦ',
        description: 'Continental mixed grill: tender steak cuts, grilled chicken breast, herb sausage, buttered vegetables & fries',
        price: 1000,
        photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_chicken_mexican',
        category_id: 'cat_asian_fusion',
        name: 'Chicken Mexican',
        name_amharic: 'ቺክን ሜክሲካን (የዶሮ ሜክሲካን)',
        description: 'Zesty marinated chicken strips tossed with sweet peppers, onions, jalapeños, cumin & fresh lime salsa',
        price: 800,
        photo_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80',
        prep_time_minutes: 16,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_supreme_spice_chicken',
        category_id: 'cat_asian_fusion',
        name: 'Supreme Spice Chicken',
        name_amharic: 'ሱፕሪም ስፓይሲ ዶሮ (የተቀመመ ዶሮ)',
        description: 'Fire-grilled spicy marinated chicken glazed with chili-garlic sauce and served with seasoned potato wedges',
        price: 900,
        photo_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_flank_steak',
        category_id: 'cat_asian_fusion',
        name: 'Flank Steak',
        name_amharic: 'ፍላንክ ስቴክ',
        description: 'Prime marinated beef flank steak grilled to order, sliced thin across the grain with chimichurri sauce',
        price: 600,
        photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80',
        prep_time_minutes: 18,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_chicken_fajita',
        category_id: 'cat_asian_fusion',
        name: 'Chicken Fajita',
        name_amharic: 'ቺክን ፋሂታ (የዶሮ ፋሂታ)',
        description: 'Sizzling skillet platter of seasoned chicken breast strips, charred onions, sweet bell peppers and warm tortillas',
        price: 800,
        photo_url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=80',
        prep_time_minutes: 16,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_fried_chicken',
        category_id: 'cat_asian_fusion',
        name: 'Fried Chicken',
        name_amharic: 'የተጠበሰ ዶሮ (ፍራይድ ቺክን)',
        description: 'Crispy southern-style golden fried chicken with succulent juicy meat, served with golden chips and dip',
        price: 900,
        photo_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&q=80',
        prep_time_minutes: 16,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_full_roast_chicken',
        category_id: 'cat_asian_fusion',
        name: 'Full Roast Chicken',
        name_amharic: 'ሙሉ የተጠበሰ ዶሮ (ሮስት ቺክን)',
        description: 'Whole oven-roasted herb chicken with golden crispy skin, served with roasted potatoes & rich gravy',
        price: 3000,
        photo_url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&q=80',
        prep_time_minutes: 30,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'asian_half_roast_chicken',
        category_id: 'cat_asian_fusion',
        name: 'Half Roast Chicken',
        name_amharic: 'ግማሽ የተጠበሰ ዶሮ',
        description: 'Half succulent oven-roasted seasoned chicken with golden brown skin and side salad or chips',
        price: 1600,
        photo_url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&q=80',
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
    },
    // 10. ፓስታ እና ሩዝ (Pasta & Rice)
    {
        id: 'pasta_meat_sauce',
        category_id: 'cat_pasta_rice',
        name: 'Meat Sauce',
        name_amharic: 'ፓስታ በስጋ ስጎ (ሚት ሶስ)',
        description: 'Italian pasta served with rich slow-cooked minced beef Bolognese sauce and shaved parmesan cheese',
        price: 450,
        photo_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d62817d3?w=600&q=80',
        prep_time_minutes: 14,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pasta_vegetable',
        category_id: 'cat_pasta_rice',
        name: 'Vegetable',
        name_amharic: 'ፓስታ/ሩዝ በአትክልት',
        description: 'Fresh al dente pasta or jasmine rice tossed with sautéed zucchini, bell peppers, carrots, garlic & olive oil',
        price: 300,
        photo_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pasta_tomato_sauce',
        category_id: 'cat_pasta_rice',
        name: 'Tomato Sauce',
        name_amharic: 'ፓስታ በቲማቲም ስጎ (ቶማቶ ሶስ)',
        description: 'Traditional Neapolitan marinara pasta simmered with ripe San Marzano style tomatoes, basil, garlic and extra virgin olive oil',
        price: 300,
        photo_url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&q=80',
        prep_time_minutes: 12,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pasta_tuna_sauce',
        category_id: 'cat_pasta_rice',
        name: 'Tuna Sauce',
        name_amharic: 'ፓስታ በቱና ስጎ (ቱና ሶስ)',
        description: 'Savory Mediterranean pasta simmered with flaked tuna, black olives, capers, garlic and rich tomato sauce',
        price: 480,
        photo_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d62817d3?w=600&q=80',
        prep_time_minutes: 14,
        routing_destination: 'KITCHEN'
    },
    {
        id: 'pasta_lazagna',
        category_id: 'cat_pasta_rice',
        name: 'Lazagna',
        name_amharic: 'ላዛኛ',
        description: 'Golden oven-baked layered pasta sheets with seasoned beef ragu, velvety bechamel sauce & melted mozzarella cheese',
        price: 650,
        photo_url: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=600&q=80',
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
    },
    // 11. ቀዝቃዛ መጠጦች (Cold Drinks)
    {
        id: 'drink_soft_drinks',
        category_id: 'cat_cold_drinks',
        name: 'Soft Drinks',
        name_amharic: 'ለስላሳ መጠጦች',
        description: 'Chilled refreshing bottled/canned sodas: Coca-Cola, Sprite, Fanta, Mirinda & Tonic',
        price: 80,
        photo_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80',
        prep_time_minutes: 2,
        routing_destination: 'BAR'
    },
    {
        id: 'drink_beer',
        category_id: 'cat_cold_drinks',
        name: 'Beer',
        name_amharic: 'ቢራ',
        description: 'Ice-cold premium Ethiopian lager beer (Habesha, St. George, Walia, Bedele) served chilled',
        price: 140,
        photo_url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&q=80',
        prep_time_minutes: 2,
        routing_destination: 'BAR'
    },
    {
        id: 'drink_1lt_water',
        category_id: 'cat_cold_drinks',
        name: '1lt Water',
        name_amharic: '1 ሊትር ውሃ',
        description: 'Pure, fresh bottled natural Ethiopian highland spring mineral water (1.0 Liter)',
        price: 70,
        photo_url: 'https://images.unsplash.com/photo-1559839914-1b33364f7b60?w=600&q=80',
        prep_time_minutes: 1,
        routing_destination: 'BAR'
    },
    {
        id: 'drink_05_water',
        category_id: 'cat_cold_drinks',
        name: '0.5 Water',
        name_amharic: 'ግማሽ ሊትር ውሃ (0.5 ሊትር)',
        description: 'Natural bottled mineral spring water (500ml / 0.5 Liter)',
        price: 60,
        photo_url: 'https://images.unsplash.com/photo-1559839914-1b33364f7b60?w=600&q=80',
        prep_time_minutes: 1,
        routing_destination: 'BAR'
    },
    {
        id: 'drink_sinq',
        category_id: 'cat_cold_drinks',
        name: 'Sinq',
        name_amharic: 'ስንቅ (የብቅል ለስላሳ መጠጥ)',
        description: 'Wholesome Ethiopian non-alcoholic malt beverage with rich roasted barley flavor and vitamins',
        price: 130,
        photo_url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80',
        prep_time_minutes: 2,
        routing_destination: 'BAR'
    },
    {
        id: 'drink_nigus',
        category_id: 'cat_cold_drinks',
        name: 'Nigus',
        name_amharic: 'ንጉሥ (የብቅል ለስላሳ መጠጥ)',
        description: 'Premium malt beverage packed with energy, natural goodness and smooth caramel finish',
        price: 120,
        photo_url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80',
        prep_time_minutes: 2,
        routing_destination: 'BAR'
    }
];
/**
 * Seeds or updates the complete official restaurant menu in the database
 */
export function seedOfficialMenu(force = false) {
    try {
        const existingCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
        if (!force && existingCount && existingCount.count >= 50) {
            console.log(`[Official Menu] Already seeded (${existingCount.count} items). Skipping.`);
            return;
        }
        console.log('[Official Menu] Seeding all 11 official menu categories and items with photos...');
        const tx = db.transaction(() => {
            // 1. Categories
            const insertCategory = db.prepare(`
        INSERT INTO menu_categories (id, name, name_amharic, icon, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          name_amharic = excluded.name_amharic,
          icon = excluded.icon,
          sort_order = excluded.sort_order,
          is_active = 1
      `);
            for (const cat of OFFICIAL_CATEGORIES) {
                insertCategory.run(cat.id, cat.name, cat.name_amharic, cat.icon, cat.sort_order);
            }
            // 2. Menu Items
            const insertItem = db.prepare(`
        INSERT INTO menu_items (
          id, category_id, name, name_amharic, description, price, photo_url, prep_time_minutes, routing_destination, is_available, is_tax_inclusive
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
        ON CONFLICT(id) DO UPDATE SET
          category_id = excluded.category_id,
          name = excluded.name,
          name_amharic = excluded.name_amharic,
          description = excluded.description,
          price = excluded.price,
          photo_url = excluded.photo_url,
          prep_time_minutes = excluded.prep_time_minutes,
          routing_destination = excluded.routing_destination,
          is_available = 1,
          deleted_at = NULL
      `);
            for (const item of OFFICIAL_MENU_ITEMS) {
                insertItem.run(item.id, item.category_id, item.name, item.name_amharic, item.description, item.price, item.photo_url, item.prep_time_minutes, item.routing_destination);
            }
        });
        tx();
        console.log(`[Official Menu] ✓ Successfully seeded ${OFFICIAL_CATEGORIES.length} categories and ${OFFICIAL_MENU_ITEMS.length} menu items!`);
    }
    catch (err) {
        console.error('[Official Menu] Error seeding official menu:', err);
    }
}
