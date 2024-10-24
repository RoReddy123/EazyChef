// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import GroceryList from '../GroceryList'; // Update the path accordingly
import MealPlan from '../(tabs)/MealPlan'; // The screen you navigate back to

const Stack = createStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="PreviousScreen">
        <Stack.Screen 
          name="meal_plan" 
          component={MealPlan} 
          options={{ headerShown: false }} // Hide header if you want to use custom headers
        />
        <Stack.Screen 
          name="GroceryList" 
          component={GroceryList} 
          options={{ headerShown: false }} // We'll create a custom header in GroceryList
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
