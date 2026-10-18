export type FeedbackLanguage = 'en' | 'am' | 'om';

export interface FeedbackDictionary {
  app_name_fallback: string;
  tagline_fallback: string;
  customer_review_title: string;
  customer_review_subtitle: string;
  branch_label: string;
  table_label: string;
  waiter_label: string;
  select_waiter_placeholder: string;
  overall_experience_title: string;
  tap_to_rate: string;
  
  rating_1: string;
  rating_2: string;
  rating_3: string;
  rating_4: string;
  rating_5: string;

  aspects_title: string;
  aspect_food: string;
  aspect_service: string;
  aspect_cleanliness: string;
  aspect_ambiance: string;

  quick_tags_title: string;
  tag_delicious_food: string;
  tag_fast_service: string;
  tag_friendly_staff: string;
  tag_clean_place: string;
  tag_great_coffee: string;
  tag_fresh_bakery: string;
  tag_slow_service: string;
  tag_cold_food: string;
  tag_too_loud: string;
  tag_needs_attention: string;

  dishes_title: string;
  dishes_subtitle: string;
  comment_title: string;
  comment_placeholder: string;

  contact_title: string;
  contact_subtitle: string;
  name_placeholder: string;
  phone_placeholder: string;
  email_placeholder: string;

  submit_btn: string;
  submitting_btn: string;

  thank_you_title: string;
  thank_you_msg: string;
  thank_you_sub: string;
  submit_another_btn: string;

  error_select_rating: string;
  error_submission_failed: string;
}

export const FEEDBACK_TRANSLATIONS: Record<FeedbackLanguage, FeedbackDictionary> = {
  en: {
    app_name_fallback: 'Yo Burger & Restaurant',
    tagline_fallback: 'Delicious Burgers & Seamless Hospitality',
    customer_review_title: 'Guest Feedback & Reviews',
    customer_review_subtitle: 'How was your dining experience with us today?',
    branch_label: 'Branch Location',
    table_label: 'Table',
    waiter_label: 'Your Server / Waiter',
    select_waiter_placeholder: 'Select server (optional)',
    overall_experience_title: 'Overall Rating',
    tap_to_rate: 'Tap a star to rate your visit',

    rating_1: 'Terrible',
    rating_2: 'Poor',
    rating_3: 'Average',
    rating_4: 'Good',
    rating_5: 'Outstanding!',

    aspects_title: 'Detailed Aspect Ratings',
    aspect_food: 'Food Quality & Taste',
    aspect_service: 'Service Speed & Hospitality',
    aspect_cleanliness: 'Cleanliness & Hygiene',
    aspect_ambiance: 'Atmosphere & Music',

    quick_tags_title: 'Quick Highlights',
    tag_delicious_food: 'Delicious Food',
    tag_fast_service: 'Fast Service',
    tag_friendly_staff: 'Friendly Staff',
    tag_clean_place: 'Clean Dining Area',
    tag_great_coffee: 'Great Coffee',
    tag_fresh_bakery: 'Fresh Bakery',
    tag_slow_service: 'Slow Service',
    tag_cold_food: 'Cold Food',
    tag_too_loud: 'Too Loud / Noisy',
    tag_needs_attention: 'Needs Attention',

    dishes_title: 'Dishes You Enjoyed',
    dishes_subtitle: 'Tap dishes you tasted to highlight them',
    comment_title: 'Tell Us More',
    comment_placeholder: 'Share your compliments, suggestions, or issues with our management...',

    contact_title: 'Your Contact Details (Optional)',
    contact_subtitle: 'Leave your details if you would like a manager follow-up or exclusive promotions',
    name_placeholder: 'Your Full Name (optional)',
    phone_placeholder: 'Phone Number (optional)',
    email_placeholder: 'Email Address (optional)',

    submit_btn: 'Submit Your Feedback',
    submitting_btn: 'Submitting Feedback...',

    thank_you_title: 'Thank You for Dining With Us!',
    thank_you_msg: 'Your feedback has been received and shared directly with restaurant management.',
    thank_you_sub: 'We constantly strive to improve our hospitality and look forward to serving you again soon!',
    submit_another_btn: 'Submit Another Review',

    error_select_rating: 'Please select an overall star rating (1-5 stars)',
    error_submission_failed: 'Unable to submit your feedback. Please check your connection and try again.'
  },

  am: {
    app_name_fallback: 'ዮ በርገር እና ሬስቶራንት',
    tagline_fallback: 'ጣፋጭ በርገር እና እንከንየለሽ መስተንግዶ',
    customer_review_title: 'የደንበኛ አስተያየት እና ምዘና',
    customer_review_subtitle: 'የዛሬው ቆይታዎ እና መስተንግዷችን እንዴት ነበር?',
    branch_label: 'ቅርንጫፍ',
    table_label: 'ጠረጴዛ',
    waiter_label: 'ያስተናገደዎት አገልጋይ',
    select_waiter_placeholder: 'አገልጋይ ይምረጡ (አማራጭ)',
    overall_experience_title: 'አጠቃላይ ደረጃ',
    tap_to_rate: 'ደረጃ ለመስጠት ኮከቡን ይጫኑ',

    rating_1: 'በጣም መጥፎ',
    rating_2: 'መጥፎ',
    rating_3: 'መካከለኛ',
    rating_4: 'ጥሩ',
    rating_5: 'ምርጥ / ከፍተኛ!',

    aspects_title: 'የአገልግሎት ዘርፎች ምዘና',
    aspect_food: 'የምግብ ጥራት እና ጣዕም',
    aspect_service: 'የመስተንግዶ ፍጥነትና ትህትና',
    aspect_cleanliness: 'የአካባቢው ንፅህና',
    aspect_ambiance: 'የከባቢው ድባብ እና ሙዚቃ',

    quick_tags_title: 'ፈጣን መለያዎች',
    tag_delicious_food: 'ጣፋጭ ምግብ',
    tag_fast_service: 'ፈጣን መስተንግዶ',
    tag_friendly_staff: 'ትሁት ሰራተኞች',
    tag_clean_place: 'ንጹህ አካባቢ',
    tag_great_coffee: 'ጥሩ ቡና',
    tag_fresh_bakery: 'ትኩስ ኬክ',
    tag_slow_service: 'የዘገየ መስተንግዶ',
    tag_cold_food: 'የቀዘቀዘ ምግብ',
    tag_too_loud: 'ከፍተኛ ጩኸት',
    tag_needs_attention: 'ማሻሻያ ያስፈልገዋል',

    dishes_title: 'የተመገቧቸው ምግቦች',
    dishes_subtitle: 'ያዘዟቸውን ምግቦች በመንካት ይምረጡ',
    comment_title: 'ተጨማሪ አስተያየት',
    comment_placeholder: 'ጥንካሬዎቻችንን፣ ድክመቶቻችንን ወይም ማሻሻያ ሃሳብዎን እዚህ ይጻፉ...',

    contact_title: 'የእርስዎ አድራሻ (አማራጭ)',
    contact_subtitle: 'ስራ አስኪያጃችን እንዲያነጋግርዎት ወይም ልዩ ቅናሾች እንዲደርስዎ መረጃዎን ያስቀምጡ',
    name_placeholder: 'ሙሉ ስም (አማራጭ)',
    phone_placeholder: 'ስልክ ቁጥር (አማራጭ)',
    email_placeholder: 'ኢሜይል (አማራጭ)',

    submit_btn: 'አስተያየቴን ላክ',
    submitting_btn: 'በመላክ ላይ...',

    thank_you_title: 'ስለጎበኙን እናመሰግናለን!',
    thank_you_msg: 'አስተያየትዎ በተሳካ ሁኔታ ደርሶናል፤ በቀጥታም ለስራ አስኪያጅ ተላልፏል።',
    thank_you_sub: 'አገልግሎታችንን ለማሻሻል ሁሌም እንተጋለን፤ በድጋሚ በደስታ እናስተናግድዎታለን!',
    submit_another_btn: 'ሌላ አስተያየት ይስጡ',

    error_select_rating: 'እባክዎ አጠቃላይ የኮከብ ደረጃ ይምረጡ (ከ1-5 ኮከብ)',
    error_submission_failed: 'አስተያየትዎን መላክ አልተቻለም። እባክዎ ኢንተርኔትዎን አረጋግጠው በድጋሚ ይሞክሩ።'
  },

  om: {
    app_name_fallback: 'Yoo Bargar fi Reestoraantii',
    tagline_fallback: 'Bargar Mi\'aawaa fi Keessummeessaa Olaanaa',
    customer_review_title: 'Yaada fi Qorannoo Maamiltootaa',
    customer_review_subtitle: 'Har\'a turtii fi tajaajilli keenya isiniif akkam ture?',
    branch_label: 'Damee Reestoraantichaa',
    table_label: 'Minjaala',
    waiter_label: 'Koomarii / Keessummeessaa',
    select_waiter_placeholder: 'Keessummeessaa filadhaa (yoo barbaaddan)',
    overall_experience_title: 'Sadarkaa Waliigalaa',
    tap_to_rate: 'Sadarkaa kennuuf urjii tuqaa',

    rating_1: 'Baay\'ee Badaa',
    rating_2: 'Badaa',
    rating_3: 'Giddu-galeessa',
    rating_4: 'Gaarii',
    rating_5: 'Baay\'ee Gaarii / Olaanaa!',

    aspects_title: 'Qorannoo Dameewwan Adda Addaa',
    aspect_food: 'Qulqullina fi Mi\'aa Nyaataa',
    aspect_service: 'Saffisa fi Kabaja Tajaajilaa',
    aspect_cleanliness: 'Qulqullina Naannoo fi Minjaalaa',
    aspect_ambiance: 'Haala Naannoo fi Sagalee',

    quick_tags_title: 'Ibsitoota Saffisaa',
    tag_delicious_food: 'Nyaata Mi\'aawaa',
    tag_fast_service: 'Tajaajila Saffisaa',
    tag_friendly_staff: 'Hojjetoota Gaarii',
    tag_clean_place: 'Bakka Qulqulluu',
    tag_great_coffee: 'Buna Mi\'aawaa',
    tag_fresh_bakery: 'Keekii Haaraa',
    tag_slow_service: 'Tajaajila Suuta',
    tag_cold_food: 'Nyaata Qabbanaa\'aa',
    tag_too_loud: 'Sagalee Ol-ka\'aa',
    tag_needs_attention: 'Xiyyeeffannoo Barbaada',

    dishes_title: 'Nyaatawwan Nyaattan',
    dishes_subtitle: 'Nyaatawwan yaaltan filachuun yaada keessan kennaa',
    comment_title: 'Yaada Dabalataa',
    comment_placeholder: 'Yaada, komii yookaan gorsa qabdan asitti barreessaa...',

    contact_title: 'Oodeeffannoo Keessan (Yoo barbaaddan)',
    contact_subtitle: 'Hogganaan keenya akka isin qunnamuuf odeeffannoo keessan guutaa',
    name_placeholder: 'Maqaa Guutuu (yoo barbaaddan)',
    phone_placeholder: 'Lakk. Bilbilaa (yoo barbaaddan)',
    email_placeholder: 'Imeelii (yoo barbaaddan)',

    submit_btn: 'Yaada Koo Ergi',
    submitting_btn: 'Ergamaa jira...',

    thank_you_title: 'Nu Daawwachuu Keessaniif Galatoomaa!',
    thank_you_msg: 'Yaanni keessan nuuf ga\'eera; hogganaafis kallattiin ergameera.',
    thank_you_sub: 'Tajaajila keenya fooyyessuuf yeroo hunda ni tattaafanna. Ammas deebitanii akka nu daawwattan kabajaan isin affeerra!',
    submit_another_btn: 'Yaada Biraa Ergi',

    error_select_rating: 'Moo yaada kennuuf urjii sadarkaa (1-5) filadhaa',
    error_submission_failed: 'Yaada keessan erguun hin danda\'amne. Sarara interneetii keessan mirkaneessaa ammas yaalaa.'
  }
};
