import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Modal,
  TextInput,
  Button,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format, startOfWeek, addDays } from 'date-fns';
import uuid from 'react-native-uuid';
import { db } from '../configs/FirebaseConfig';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { AuthContext } from '../components/AuthProvider';
import debounce from 'lodash.debounce';
import { searchIngredients, getAisle } from '../services/USDAService';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// Define fixedOrder outside the component for reusability
const fixedOrder = [
  "Produce",
  "Meat and Seafood",
  "Dairy",
  "Frozen",
  "Snacks",
  "Bakery",
  "Beverages",
  "Extras"
];

// Manual aisle mapping for ingredients that are miscategorized or not using USDA API
const manualAisleMapping = {
  'steak': 'Meat and Seafood',
  // Add more mappings as needed
};

const GroceryList = () => {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const [groceryItems, setGroceryItems] = useState([]); // Ingredients from meal plan
  const [customIngredients, setCustomIngredients] = useState([]); // Manually added ingredients
  const [loading, setLoading] = useState(true);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addedIngredients, setAddedIngredients] = useState([]);
  const [apiLimitReached, setApiLimitReached] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const today = new Date();
      const week = getCurrentWeek(today);
      fetchGroceryList(week);
      fetchCustomIngredients();
    } else {
      setLoading(false);
      setGroceryItems([]);
      setCustomIngredients([]);
    }
  }, [user]);

  const getCurrentWeek = (date) => {
    const start = startOfWeek(date, { weekStartsOn: 0 });
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(addDays(start, i));
    }
    return week;
  };

  const formatDateKey = (date) => format(date, 'yyyy-MM-dd');

  const fetchGroceryList = async (week) => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const startDate = formatDateKey(week[0]);
      const endDate = formatDateKey(week[6]);

      console.log(`Fetching meal plan from ${startDate} to ${endDate}`);

      const mealPlanDocRef = doc(db, 'MealPlans', user.uid);
      const mealPlanDoc = await getDoc(mealPlanDocRef);

      if (!mealPlanDoc.exists()) {
        console.log('No meal plan found for user.');
        setGroceryItems([]);
        setLoading(false);
        return;
      }

      const mealPlanData = mealPlanDoc.data();
      console.log('Meal plan data:', mealPlanData);

      const mealTypes = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'];
      const recipeFrequencyMap = new Map();

      mealTypes.forEach((mealType) => {
        const recipes = mealPlanData[mealType] || [];
        recipes.forEach((recipe) => {
          const recipeDate = recipe.date;
          if (recipeDate >= startDate && recipeDate <= endDate) {
            if (recipe.recipeId) {
              const currentCount = recipeFrequencyMap.get(recipe.recipeId) || 0;
              recipeFrequencyMap.set(recipe.recipeId, currentCount + 1);
            }
          }
        });
      });

      console.log('Recipe frequency map:', recipeFrequencyMap);

      if (recipeFrequencyMap.size === 0) {
        console.log('No recipes found in the meal plan for the current week.');
        setGroceryItems([]);
        setLoading(false);
        return;
      }

      const uniqueRecipeIds = Array.from(recipeFrequencyMap.keys());
      console.log('Unique recipe IDs:', uniqueRecipeIds);

      const recipePromises = uniqueRecipeIds.map((id) => getDoc(doc(db, 'AllRecipes', id)));
      const recipeDocs = await Promise.all(recipePromises);

      const validRecipes = recipeDocs.filter(doc => doc.exists());

      console.log(`Valid recipes fetched: ${validRecipes.length}`);

      if (validRecipes.length === 0) {
        console.log('No valid recipes found.');
        setGroceryItems([]);
        setLoading(false);
        return;
      }

      const combinedIngredientsMap = new Map();

      for (const recipeDoc of validRecipes) {
        const recipeId = recipeDoc.id;
        const recipeData = recipeDoc.data();
        const frequency = recipeFrequencyMap.get(recipeId) || 1;
        const { ingredients } = recipeData;

        console.log(`Processing recipe: ${recipeId}`, recipeData);

        if (!Array.isArray(ingredients)) {
          console.warn(`Ingredients for recipe ${recipeId} are not an array.`);
          continue;
        }

        for (const ingredient of ingredients) {
          // Use 'description' instead of 'name'
          const description = ingredient.description || ingredient.name;
          if (!description) {
            console.warn(`Ingredient without a description/name found in recipe ${recipeId}. Skipping.`);
            continue;
          }

          const normalizedDescription = description.trim().toLowerCase();
          const normalizedUnit = ingredient.unit ? ingredient.unit.trim().toLowerCase() : '';
          const key = `${normalizedDescription}-${normalizedUnit}`;

          let quantity = parseFloat(ingredient.quantity);
          if (isNaN(quantity)) {
            console.warn(`Missing or invalid quantity for ingredient "${description}" in recipe ${recipeId}. Defaulting to 1.`);
            quantity = 1; // Assign default quantity
          }

          const totalQuantity = quantity * frequency;

          if (combinedIngredientsMap.has(key)) {
            const existingIngredient = combinedIngredientsMap.get(key);
            existingIngredient.quantity += totalQuantity;
          } else {
            let aisle = 'Extras';

            try {
              // Check manual mapping first
              if (manualAisleMapping[normalizedDescription]) {
                aisle = manualAisleMapping[normalizedDescription];
                console.log(`Manual mapping: "${description}" assigned to aisle "${aisle}".`);
              } else {
                aisle = await getAisle(description);
                console.log(`Aisle for "${description}":`, aisle);
              }

              // Validate aisle
              if (!fixedOrder.includes(aisle)) {
                console.warn(`Aisle "${aisle}" for "${description}" is not in fixedOrder. Assigning to 'Extras'.`);
                aisle = 'Extras';
              }
            } catch (error) {
              console.error(`Error fetching aisle for "${description}":`, error);
              // Aisle remains 'Extras'
            }

            combinedIngredientsMap.set(key, {
              id: uuid.v4(),
              description: description.trim(),
              quantity: totalQuantity || 0,
              unit: ingredient.unit ? ingredient.unit.trim() : '',
              aisle: aisle || 'Extras',
              isCustom: false,
              checked: false,
            });
          }
        }
      }

      const combinedIngredients = Array.from(combinedIngredientsMap.values());
      console.log('Combined Ingredients:', combinedIngredients);

      setGroceryItems(combinedIngredients);
      setLoading(false);
    } catch (error) {
      console.error("Error in fetchGroceryList:", error);
      setLoading(false);
      Alert.alert('Error fetching grocery list', error.message);
    }
  };

  const fetchCustomIngredients = async () => {
    if (!user) return;

    try {
      const customIngredientsDocRef = doc(db, 'CustomIngredients', user.uid);
      const customIngredientsDoc = await getDoc(customIngredientsDocRef);

      if (customIngredientsDoc.exists()) {
        const customIngredientsData = customIngredientsDoc.data();
        const customIngs = customIngredientsData.ingredients || [];
        console.log('Custom ingredients fetched:', customIngs);
        const updatedCustomIngs = await Promise.all(customIngs.map(async (ingredient) => {
          if (!ingredient.description) {
            console.warn('Custom ingredient without a description found. Skipping.');
            return null;
          }

          let quantity = parseFloat(ingredient.quantity);
          if (isNaN(quantity)) {
            console.warn(`Invalid quantity for custom ingredient "${ingredient.description}". Defaulting to 1.`);
            quantity = 1; // Assign default quantity
          }

          let aisle = 'Extras';
          try {
            aisle = await getAisle(ingredient.description);
            console.log(`Aisle for custom ingredient "${ingredient.description}":`, aisle);
          } catch (error) {
            console.error(`Error fetching aisle for custom ingredient "${ingredient.description}":`, error);
            // Aisle remains 'Extras'
          }

          // Validate aisle
          if (!fixedOrder.includes(aisle)) {
            console.warn(`Aisle "${aisle}" for "${ingredient.description}" is not in fixedOrder. Assigning to 'Extras'.`);
            aisle = 'Extras';
          }

          return {
            id: ingredient.id || uuid.v4(),
            description: ingredient.description.trim(),
            quantity: quantity || 0,
            unit: ingredient.unit ? ingredient.unit.trim() : '',
            aisle: aisle || 'Extras',
            isCustom: ingredient.isCustom || true,
            checked: ingredient.checked || false,
          };
        }));

        const filteredCustomIngs = updatedCustomIngs.filter(ing => ing !== null);
        console.log('Filtered Custom Ingredients:', filteredCustomIngs);
        setCustomIngredients(filteredCustomIngs);
      } else {
        console.log('No custom ingredients found for user.');
        setCustomIngredients([]);
      }
    } catch (error) {
      console.error("Error in fetchCustomIngredients:", error);
      Alert.alert('Error fetching custom ingredients', error.message);
    }
  };

  const handleQueryChange = (text) => {
    setSearchQuery(text);
    debouncedSearch(text); // Handle debounced search query changes
  };

  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 2 || apiLimitReached) {
        setSearchResults([]);
        return;
      }

      try {
        setSearchLoading(true);
        const results = await searchIngredients(query);
        console.log('Search results:', results);

        const filteredResults = results.filter(result => {
          const description = result.description ? result.description.toLowerCase() : '';
          return !description.includes('quesadilla') && !description.includes('dish') && !description.includes('recipe');
        });

        console.log('Filtered search results:', filteredResults);

        if (Array.isArray(filteredResults)) {
          setSearchResults(filteredResults);
        } else {
          setSearchResults([]);
          console.error('Unexpected response format:', results);
          Alert.alert('Error', 'Unexpected response from the API');
        }
      } catch (error) {
        console.error('Error during ingredient search:', error);

        if (error.response?.status === 429) {
          setApiLimitReached(true);
          Alert.alert(
            'API Limit Reached',
            'You have reached the daily limit for ingredient searches. Please try again tomorrow.'
          );
        } else {
          Alert.alert('Error', error.message || 'Failed to fetch from USDA API. You can manually add ingredients.');
        }

        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500),
    [apiLimitReached]
  );

  const handleSelectSuggestion = async (suggestion) => {
    const description = suggestion.description || 'Unknown Ingredient';

    const newIngredient = {
      id: suggestion.fdcId || uuid.v4(),
      description: description,
      quantity: 1, // Default quantity
      unit: '',     // Default unit
      aisle: 'Extras',
      isCustom: true,
      checked: false,
    };

    try {
      const aisle = await getAisle(description);
      newIngredient.aisle = aisle || 'Extras';
      console.log(`Aisle for selected ingredient "${description}":`, aisle);

      // Validate aisle
      if (!fixedOrder.includes(newIngredient.aisle)) {
        console.warn(`Aisle "${newIngredient.aisle}" for "${description}" is not in fixedOrder. Assigning to 'Extras'.`);
        newIngredient.aisle = 'Extras';
      }
    } catch (error) {
      console.error(`Error fetching aisle for "${description}":`, error);
      // Aisle remains 'Extras'
    }

    setAddedIngredients([...addedIngredients, newIngredient]);
    setSearchResults([]);
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const saveCustomIngredients = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (addedIngredients.length === 0) {
      Alert.alert('No Ingredients', 'Please add at least one ingredient.');
      return;
    }

    try {
      const customIngredientsDocRef = doc(db, 'CustomIngredients', user.uid);

      const ingredientsToAdd = await Promise.all(addedIngredients.map(async (ingredient) => {
        if (!ingredient.description) {
          console.warn('Ingredient without description found in addedIngredients. Skipping.');
          return null;
        }

        let aisle = 'Extras';
        try {
          aisle = await getAisle(ingredient.description);
          console.log(`Aisle for saving ingredient "${ingredient.description}":`, aisle);

          // Check manual mapping
          const normalizedDescription = ingredient.description.trim().toLowerCase();
          if (manualAisleMapping[normalizedDescription]) {
            aisle = manualAisleMapping[normalizedDescription];
            console.log(`Manual mapping: "${ingredient.description}" assigned to aisle "${aisle}".`);
          }

          // Validate aisle
          if (!fixedOrder.includes(aisle)) {
            console.warn(`Aisle "${aisle}" for "${ingredient.description}" is not in fixedOrder. Assigning to 'Extras'.`);
            aisle = 'Extras';
          }
        } catch (error) {
          console.error(`Error fetching aisle for "${ingredient.description}":`, error);
          // Aisle remains 'Extras'
        }

        return {
          id: ingredient.id,
          description: ingredient.description,
          quantity: ingredient.quantity || 0,
          unit: ingredient.unit ? ingredient.unit.trim() : '',
          aisle: aisle || 'Extras',
          checked: ingredient.checked,
          isCustom: true,
        };
      }));

      const filteredIngredientsToAdd = ingredientsToAdd.filter(ing => ing !== null);
      console.log('Ingredients to add:', filteredIngredientsToAdd);

      if (filteredIngredientsToAdd.length === 0) {
        Alert.alert('No Valid Ingredients', 'All added ingredients are invalid.');
        return;
      }

      const customIngredientsDoc = await getDoc(customIngredientsDocRef);

      if (customIngredientsDoc.exists()) {
        console.log('Updating existing custom ingredients document.');
        await updateDoc(customIngredientsDocRef, {
          ingredients: arrayUnion(...filteredIngredientsToAdd),
        });
      } else {
        console.log('Creating new custom ingredients document.');
        await setDoc(customIngredientsDocRef, {
          ingredients: filteredIngredientsToAdd,
        });
      }

      setCustomIngredients([...customIngredients, ...filteredIngredientsToAdd]);
      setAddedIngredients([]);
      setIsAddModalVisible(false);
    } catch (error) {
      console.error("Error saving custom ingredients:", error);
      Alert.alert('Error saving custom ingredients', error.message);
    }
  };

  const toggleCheckbox = (item) => {
    if (item.isCustom) {
      const updatedCustomIngredients = customIngredients.map(ingredient =>
        ingredient.id === item.id ? { ...ingredient, checked: !ingredient.checked } : ingredient
      );
      setCustomIngredients(updatedCustomIngredients);
    } else {
      const updatedGroceryItems = groceryItems.map(ingredient =>
        ingredient.id === item.id
          ? { ...ingredient, checked: !ingredient.checked }
          : ingredient
      );
      setGroceryItems(updatedGroceryItems);
    }
  };

  const getSections = () => {
    const sectionsMap = {};
    const allIngredients = [...groceryItems, ...customIngredients];

    allIngredients.forEach((item) => {
      const category = item.aisle || 'Extras';
      if (!sectionsMap[category]) {
        sectionsMap[category] = [];
      }
      sectionsMap[category].push(item);
    });

    const sections = fixedOrder
      .filter(category => sectionsMap[category])
      .map((category) => ({
        title: category,
        data: sectionsMap[category],
      }));

    // Add any categories not in fixedOrder at the end
    const additionalCategories = Object.keys(sectionsMap).filter(
      category => !fixedOrder.includes(category)
    );

    additionalCategories.forEach(category => {
      sections.push({
        title: category,
        data: sectionsMap[category],
      });
    });

    console.log('Sections for SectionList:', sections);
    return sections;
  };

  const handleShareGroceryList = async () => {
    try {
      const groceryListId = uuid.v4(); // Generate a unique ID for the shared grocery list

      // Save the grocery list in Firestore with both groceryItems and customIngredients
      await setDoc(doc(db, 'SharedGroceryLists', groceryListId), {
        groceryItems: groceryItems || [],
        customIngredients: customIngredients || [],
        owner: user.uid,
        createdAt: new Date().toISOString(),
      });

      // Generate the shareable link to the web page that displays the full grocery list
      const shareLink = `https://food-tinder-7f07d.web.app/grocerylist.html?groceryListId=${groceryListId}`;

      // Generate a preview text with the first few items from the grocery list
      const previewItems = [...groceryItems, ...customIngredients].slice(0, 3);
      const previewText = previewItems.map(item => `${item.quantity || ''} ${item.unit || ''} ${item.description}`).join('\n');

      // Message that will be shared
      const message = `
Here's a preview of my grocery list:
${previewText}

Click here to see the full list:
${shareLink}
      `;

      // Use the native Share API to share the text and the link
      await Share.share({
        message: message,
      });

      console.log('Grocery list shared successfully.');
    } catch (error) {
      console.error('Error sharing grocery list:', error);
      Alert.alert('Error', 'Failed to share the grocery list.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007bff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grocery List</Text>
      </View>

      {/* Grocery List */}
      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
      ) : (
        <SectionList
          sections={getSections()}
          keyExtractor={(item) => item.id ? item.id.toString() : `${item.description || 'unknown'}-${item.unit || 'unknown'}`}
          renderItem={({ item }) => (
            <View style={styles.groceryItem}>
              <TouchableOpacity onPress={() => toggleCheckbox(item)}>
                <MaterialIcons
                  name={item.checked ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color="#007bff"
                />
              </TouchableOpacity>

              <View style={styles.ingredientDetails}>
                <Text
                  style={[
                    styles.groceryName,
                    item.checked && styles.crossedText
                  ]}
                >
                  {item.description || 'Unknown Ingredient'}
                </Text>
                <Text
                  style={[
                    styles.groceryQuantity,
                    item.checked && styles.crossedText
                  ]}
                >
                  {`${item.quantity || '0'} ${item.unit || ''}`.trim()}
                </Text>
              </View>
            </View>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text>No grocery items found.</Text>}
        />
      )}

      {/* Share Button */}
      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShareGroceryList}
      >
        <MaterialIcons name="share" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsAddModalVisible(true)}
      >
        <MaterialIcons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add Ingredient Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setIsAddModalVisible(false);
          setSearchQuery('');
          setSearchResults([]);
          setAddedIngredients([]);
        }}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Search and Add Ingredients</Text>

              <TextInput
                style={styles.inputModal}
                placeholder="Search for an ingredient"
                value={searchQuery}
                onChangeText={handleQueryChange}
              />

              {searchLoading && (
                <ActivityIndicator size="small" color="#007bff" style={{ marginBottom: 10 }} />
              )}

              {Array.isArray(searchResults) && searchResults.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item.fdcId || uuid.v4()}
                        onPress={() => handleSelectSuggestion(item)}
                        style={styles.suggestionItem}
                      >
                        <Text>{item.description || 'Unknown'}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Display Added Ingredients Before Saving */}
              {addedIngredients.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 5 }}>Added Ingredients:</Text>
                  <FlatList
                    data={addedIngredients}
                    keyExtractor={(item) => item.id || uuid.v4()}
                    renderItem={({ item }) => (
                      <View style={styles.groceryItem}>
                        <MaterialIcons
                          name={item.checked ? 'check-box' : 'check-box-outline-blank'}
                          size={24}
                          color="#007bff"
                        />
                        <View style={styles.ingredientDetails}>
                          <Text style={styles.groceryName}>{item.description || 'Unknown Name'}</Text>
                          <Text style={styles.groceryQuantity}>
                            {`${item.quantity || '0'} ${item.unit || ''}`.trim()}
                          </Text>
                        </View>
                      </View>
                    )}
                  />
                </View>
              )}

              {/* Modal Buttons */}
              <View style={styles.modalButtons}>
                <Button title="Save Ingredients" onPress={saveCustomIngredients} />
                <Button title="Cancel" onPress={() => setIsAddModalVisible(false)} />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  listContainer: {
    paddingBottom: 20,
  },
  sectionHeader: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ingredientDetails: {
    marginLeft: 10,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groceryName: {
    fontSize: 16,
    color: '#333',
  },
  groceryQuantity: {
    fontSize: 16,
    color: '#555',
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#28a745',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  shareButton: {
    position: 'absolute',
    bottom: 100,
    right: 30,
    backgroundColor: '#007bff',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 40,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputModal: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  suggestionsContainer: {
    maxHeight: 150,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  crossedText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
});

export default GroceryList;
