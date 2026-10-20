Pod::Spec.new do |s|
  s.name           = 'WakeWordAlarms'
  s.version        = '1.0.0'
  s.summary        = 'Native alarm scheduling for WakeWord'
  s.description    = 'iOS AlarmKit scheduling bridge for WakeWord.'
  s.license        = { :type => 'MIT' }
  s.author         = 'WakeWord'
  s.homepage       = 'https://github.com/temidayoislearning/WakeWord-Alarm'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/temidayoislearning/WakeWord-Alarm.git', :tag => s.version.to_s }
  s.source_files   = '*.{h,m,mm,swift}'
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'AlarmKit', 'AppIntents'
end
