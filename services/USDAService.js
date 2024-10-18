import Constants from 'expo-constants';
import axios from 'axios';

// Function to retrieve the USDA API key
const getUsdaApiKey = () => {
  let apiKey = '';

  if (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.USDA_API_KEY) {
    apiKey = Constants.manifest.extra.USDA_API_KEY;
  } else if (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.USDA_API_KEY) {
    apiKey = Constants.expoConfig.extra.USDA_API_KEY;
  } else {
    console.error('USDA API Key is not defined in app configuration.');
    throw new Error('USDA API Key is missing. Please define it in app.json or app.config.js under "extra".');
  }

  // Temporary log for debugging (remove in production)
  console.log("USDA API Key Retrieved:", apiKey ? "✔️" : "❌");
  return apiKey;
};

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = getUsdaApiKey();

// Allowed Categories
const allowedCategories = {
  Produce: ["fruit", "vegetable", "berries", "leafy greens", "herbs"],
  "Meat and Seafood": ["meat", "beef", "chicken", "pork", "seafood", "fish", "lamb", "turkey", "shellfish"],
  Dairy: ["dairy", "milk", "cheese", "butter", "yogurt", "cream"],
  Frozen: ["frozen"],
  Snacks: ["snacks", "chips", "nuts"],
  Bakery: ["bread", "pastries", "bakery"],
  Beverages: ["drinks", "beverages", "juice", "tea", "coffee", "soda"],
  Extras: []  // Catch-all for unrecognized ingredients
};

// Function to classify an ingredient into one of the allowed categories
const categorizeIngredient = (description) => {
  const descriptionLower = description.toLowerCase();

  for (const category in allowedCategories) {
    const keywords = allowedCategories[category];
    if (keywords.some(keyword => descriptionLower.includes(keyword))) {
      return category;
    }
  }

  return "Extras";
};

// Utility function to delay execution (for retry logic)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetches the aisle information for a given ingredient's description
export const getAisle = async (description) => {
  const normalizedQuery = description.trim().toLowerCase();

  try {
    const searchResponse = await axios.get(`${BASE_URL}/foods/search`, {
      params: {
        query: normalizedQuery,
        api_key: USDA_API_KEY,
        dataType: 'Foundation,SR Legacy',  // Ensure dataType is a string
        pageSize: 1,  // Fetch only the first result for efficiency
      },
    });

    if (searchResponse.data.foods.length === 0) {
      return "Extras";
    }

    const firstFood = searchResponse.data.foods[0];
    const category = categorizeIngredient(firstFood.description);
    return category;
  } catch (error) {
    console.error(`Error fetching aisle for ingredient "${description}":`, error);
    return "Extras";
  }
};

// Fetches ingredients based on the query with caching
const filterIngredients = (foods) => {
  const uniqueDescriptions = new Set();

  return foods.filter(item => {
    if (!item.description) return false;
    const description = item.description.toLowerCase();

    // Exclude items containing unwanted words and check for duplicates
    if (
      !description.includes('recipe') &&
      !description.includes('dish') &&
      !description.includes('quesadilla') &&
      !description.includes('chick-fil-a') &&
      !uniqueDescriptions.has(description)
    ) {
      uniqueDescriptions.add(description);
      return true;
    }
    return false;
  });
};

// Function to search for ingredients based on the query with retry logic
export const searchIngredients = async (query, retries = 3, backoff = 3000) => {
  if (!query || query.trim() === "") {
    throw new Error("Search query cannot be empty.");
  }

  try {
    console.log("Sending search query to USDA API:", query);

    const response = await axios.get(`${BASE_URL}/foods/search`, {
      params: {
        query: query.trim(),
        pageSize: 15,  // Limit results to avoid overload
        api_key: USDA_API_KEY,
        dataType: 'Foundation,SR Legacy',  // Corrected format
      },
    });

    if (response.data && response.data.foods) {
      // Filter and return the results
      return filterIngredients(response.data.foods);
    } else {
      throw new Error("Unexpected response structure from USDA API");
    }
  } catch (error) {
    console.error("Error in searchIngredients:", error);

    if (retries > 0 && error.response && error.response.status >= 500) {
      console.warn(`Retrying... Attempts left: ${retries}`);
      await delay(backoff);
      return searchIngredients(query, retries - 1, backoff * 2);
    }

    // Handle API rate-limiting error
    if (error.response && error.response.status === 429) {
      throw new Error("API rate limit exceeded. Please try again later.");
    }

    // Handle USDA server error
    if (error.response && error.response.status === 500) {
      console.error("USDA API returned a 500 error. Possible issue with USDA servers.");
      throw new Error("USDA server error. Please try again later.");
    }

    // Handle other errors
    throw error;
  }
};

// Fetches nutrition data for a specific ingredient based on its description
export const getNutritionData = async (description, quantity, unit) => {
  try {
    // Search for the food item to get the fdcId
    const searchResponse = await axios.get(`${BASE_URL}/foods/search`, {
      params: {
        query: description.trim().toLowerCase(),
        pageSize: 1,
        api_key: USDA_API_KEY,
        dataType: 'Foundation,SR Legacy',  // Ensure dataType is a string
      },
    });

    if (searchResponse.data.foods.length === 0) {
      throw new Error('Ingredient not found.');
    }

    const fdcId = searchResponse.data.foods[0].fdcId;

    // Fetch detailed information using fdcId
    const infoResponse = await axios.get(`${BASE_URL}/food/${fdcId}`, {
      params: {
        api_key: USDA_API_KEY,
      },
    });

    const infoData = infoResponse.data;
    if (!infoData.foodNutrients) {
      throw new Error('Nutrition information not available for this ingredient.');
    }

    const nutrients = infoData.foodNutrients;

    // Initialize variables to store total nutrient values
    let totalCalories = 0;
    let totalCarbohydrates = 0;
    let totalFat = 0;
    let totalProtein = 0;

    // Log the nutrients array to see if it contains any values
    console.log('Nutrients Array:', nutrients);

    // Get unit conversion factor to convert user input to grams
    const factor = getUnitConversionFactor(unit);

    // Iterate through nutrients and map them, adjusting for quantity and unit
    nutrients.forEach((nutrient) => {
      const nutrientName = nutrient.nutrient.name;
      const nutrientAmount = nutrient.amount;

      // Check nutrient name to sum up calories, carbohydrates, fat, and protein
      if (nutrientName.includes("Energy")) {
        totalCalories += (nutrientAmount * quantity * factor) / 100;  // Summing energy (calories)
      } else if (nutrientName.includes("Carbohydrate")) {
        totalCarbohydrates += (nutrientAmount * quantity * factor) / 100;  // Summing carbohydrates
      } else if (nutrientName.includes("Total lipid (fat)")) {
        totalFat += (nutrientAmount * quantity * factor) / 100;  // Summing fat
      } else if (nutrientName.includes("Protein")) {
        totalProtein += (nutrientAmount * quantity * factor) / 100;  // Summing protein
      }
    });

    // Final nutrition data output
    const totalNutrition = {
      calories: totalCalories,
      carbohydrates: totalCarbohydrates,
      fat: totalFat,
      protein: totalProtein,
    };

    // Log the final nutrition data
    console.log('Final nutrition data for ingredient:', totalNutrition);

    return totalNutrition;
  } catch (error) {
    console.error('Failed to fetch nutrition data:', error.response?.data || error.message);
    throw error;
  }
};



// Helper function to convert various units to grams
const getUnitConversionFactor = (unit) => {
  const unitLower = unit.toLowerCase();
  const conversionFactors = {
    gram: 1,
    grams: 1,
    kilogram: 1000,
    kilograms: 1000,
    ounce: 28.3495,
    ounces: 28.3495,
    pound: 453.592,
    pounds: 453.592,
    cup: 240, // Approximate grams for common ingredients, may vary
    cups: 240,
    tablespoon: 15,
    tablespoons: 15,
    teaspoon: 5,
    teaspoons: 5,
    liter: 1000,
    liters: 1000,
    milliliter: 1,
    milliliters: 1,
  };

  // Return the conversion factor or default to 1 (assuming grams as default)
  return conversionFactors[unitLower] || 1;
};

