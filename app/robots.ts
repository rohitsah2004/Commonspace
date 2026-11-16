import {SITE} from '../lib/server';export default function robots(){return {rules:{userAgent:'*',allow:'/',disallow:['/studio','/preview/','/api/']},sitemap:SITE+'/sitemap.xml'}}
