// components/HOCs/withNavigation.js
import React from 'react';
import { useNavigation } from '@react-navigation/native';

/**
 * Custom Higher-Order Component to inject the navigation prop into class components.
 * @param {React.Component} WrappedComponent - The class component to wrap.
 * @returns {React.Component} - The wrapped component with the navigation prop.
 */
const withNavigation = (WrappedComponent) => {
  return (props) => {
    const navigation = useNavigation();
    return <WrappedComponent {...props} navigation={navigation} />;
  };
};

export default withNavigation;
