const Policy = require('../models/Policy');

// Get Policy by Type
exports.getPolicy = async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['privacy', 'terms'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid policy type.' });
    }

    let policy = await Policy.findOne({ type });
    
    if (!policy) {
      if (type === 'privacy') {
        policy = {
          type: 'privacy',
          effectiveDate: '16 July 2026',
          introduction: 'METRA DIGITAL PRIVATE LIMITED respects your privacy and is committed to protecting your personal information.',
          sections: [
            {
              title: '1. Information We Collect',
              paragraph: 'We may collect:',
              list: [
                'Name',
                'Mobile number',
                'Email address',
                'Profile photo',
                'City and location information',
                'GPS location data',
                'Device information',
                'IP address',
                'Usage analytics',
                'Preferences and favourites',
                'Reviews and ratings'
              ]
            },
            {
              title: '2. Information Collected Automatically',
              paragraph: 'When you use the Platform, we may automatically collect:',
              list: [
                'Device identifiers',
                'Operating system information',
                'Log information',
                'Crash reports',
                'Usage statistics',
                'App interaction data'
              ]
            },
            {
              title: '3. How We Use Information',
              paragraph: 'We use information to:',
              list: [
                'Provide Platform services.',
                'Enable account authentication.',
                'Improve user experience.',
                'Perform analytics.',
                'Personalize content.',
                'Send updates and notifications.',
                'Conduct marketing and promotional activities.',
                'Prevent fraud and abuse.',
                'Comply with legal obligations.'
              ]
            },
            {
              title: '4. Marketing Communications',
              paragraph: 'Users may receive:\n\n• Promotional notifications\n• Marketing messages\n• Service announcements\n• Updates regarding Platform features\n\nUsers may opt out of certain communications where applicable.',
              list: []
            },
            {
              title: '5. Location Information',
              paragraph: 'The Platform may collect precise GPS location information for providing location-based experiences and improving services.',
              list: []
            },
            {
              title: '6. Virtual Try-On Data',
              paragraph: 'Camera access may be requested for Virtual Try-On functionality. Images used for Virtual Try-On are generally processed temporarily and are not permanently stored by the Company.',
              list: []
            },
            {
              title: '7. Sharing of Information',
              paragraph: 'We may share information:',
              list: [
                'With service providers assisting in Platform operations.',
                'When required by law.',
                'With government authorities, regulators, law enforcement agencies, or courts.',
                'During mergers, acquisitions, or corporate restructuring.'
              ]
            },
            {
              title: '8. Data Security',
              paragraph: 'We implement reasonable technical and organizational safeguards to protect information. However, no electronic transmission or storage system can be guaranteed to be completely secure.',
              list: []
            },
            {
              title: '9. Data Retention',
              paragraph: 'We retain personal information for as long as necessary to provide services, comply with legal obligations, resolve disputes, and enforce agreements.',
              list: []
            },
            {
              title: '10. User Rights',
              paragraph: 'Users may:',
              list: [
                'Access their information.',
                'Request corrections.',
                'Request account deletion.',
                'Withdraw certain permissions.'
              ]
            },
            {
              title: '11. Account Deletion Requests',
              paragraph: 'Users who wish to delete their account must contact the Company through the registered support email. The Company may retain certain information as required by applicable laws or legitimate business purposes.',
              list: []
            },
            {
              title: '12. Children\'s Privacy',
              paragraph: 'The Platform is designed to be safe for users of all ages. Parents and guardians are encouraged to supervise minors while using the Platform.',
              list: []
            },
            {
              title: '13. Third-Party Links',
              paragraph: 'The Platform may contain links or references to third-party websites or businesses. The Company is not responsible for third-party privacy practices.',
              list: []
            },
            {
              title: '14. Policy Updates',
              paragraph: 'The Company may update this Privacy Policy from time to time. Continued use of the Platform constitutes acceptance of the revised policy.',
              list: []
            },
            {
              title: '15. Contact',
              paragraph: 'METRA DIGITAL PRIVATE LIMITED\nRegistered Office: No.303, II Floor, 15th A Crs Rd, Chikkabommasandra, Yelahanka, Bangalore, Karnataka, India – 560064\n\nEmail: gehnadekho@gmail.com',
              list: []
            }
          ]
        };
      } else {
        policy = {
          type: 'terms',
          effectiveDate: '16 July 2026',
          introduction: 'Welcome to GehnaDekho ("Platform", "App"), owned and operated by METRA DIGITAL PRIVATE LIMITED (CIN: U46498KA2025PTC200905), having its registered office at No.303, II Floor, 15th A Crs Rd, Chikkabommasandra, Yelahanka, Bangalore, Karnataka, India – 560064 ("Company", "we", "us", "our").\n\nBy downloading, accessing, registering on, or using GehnaDekho, you agree to be bound by these Terms & Conditions ("Terms"). If you do not agree with these Terms, please do not use the Platform.',
          sections: [
            {
              title: '1. Nature of the Platform',
              paragraph: 'GehnaDekho is a digital jewellery discovery and display platform.\n\nThe Platform enables users to:',
              list: [
                'Browse jewellery listings.',
                'Discover jewellery stores and jewellers.',
                'Compare jewellery offerings.',
                'Save favourites.',
                'View promotional short videos.',
                'Use Virtual Try-On features where available.'
              ]
            },
            {
              title: '2. User Eligibility',
              paragraph: 'You must be legally competent to enter into a binding contract under applicable laws. Minors may use the Platform only under the supervision of parents or legal guardians.',
              list: []
            }
          ]
        };
      }
    }

    res.status(200).json({ success: true, policy });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Update or Create Policy
exports.updatePolicy = async (req, res) => {
  try {
    const { type } = req.params;
    const { effectiveDate, introduction, sections, contactInfo } = req.body;

    if (!['privacy', 'terms'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid policy type.' });
    }

    let policy = await Policy.findOne({ type });

    if (policy) {
      policy.effectiveDate = effectiveDate;
      policy.introduction = introduction;
      policy.sections = sections;
      policy.contactInfo = contactInfo;
      await policy.save();
    } else {
      policy = new Policy({
        type,
        effectiveDate,
        introduction,
        sections,
        contactInfo
      });
      await policy.save();
    }

    res.status(200).json({ success: true, policy, message: `${type === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'} updated successfully.` });
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
